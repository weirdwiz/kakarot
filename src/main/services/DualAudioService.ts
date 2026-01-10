import { EventEmitter } from 'events';
import { createLogger } from '@main/core/logger';
import { AUDIO_CONFIG } from '@main/config/constants';
import type { ITranscriptionProvider } from '@main/services/transcription';
import { HeadphoneDetector } from '@main/services/audio/HeadphoneDetector';

const logger = createLogger('DualAudioService');

/**
 * Native module interface.
 * Loaded dynamically from kakarot-audio native addon.
 */
interface NativeAudioModule {
  create(config?: NativeAudioConfig): number;
  setCallback(handle: number, callback: AudioFrameCallback): void;
  start(handle: number): Promise<void>;
  stop(handle: number): void;
  destroy(handle: number): void;
  isCapturing(handle: number): boolean;
  isSupported(): boolean;
}

interface NativeAudioConfig {
  sampleRate?: number;
  chunkDurationMs?: number;
  channels?: number;
  enableAEC?: boolean;
  bypassAECOnHeadphones?: boolean;
}

interface SynchronizedAudioFrame {
  mic?: Buffer;
  system?: Buffer;
  timestamp: number;
  hasMic: boolean;
  hasSystem: boolean;
  micLevel: number;
  systemLevel: number;
}

type AudioFrameCallback = (frame: SynchronizedAudioFrame) => void;

type AudioLevelCallback = (level: number) => void;

/**
 * Dual-stream audio service using native synchronized capture.
 *
 * Replaces SystemAudioService + renderer mic capture with a single
 * native module that captures both streams with aligned timestamps
 * and built-in AEC.
 *
 * Falls back to legacy approach if native module unavailable.
 */
export class DualAudioService extends EventEmitter {
  private nativeModule: NativeAudioModule | null = null;
  private handle: number | null = null;
  private transcriptionProvider: ITranscriptionProvider | null = null;
  private capturing: boolean = false;

  private micLevelCallback: AudioLevelCallback | null = null;
  private systemLevelCallback: AudioLevelCallback | null = null;

  /**
   * Check if native synchronized capture is available.
   */
  async isNativeAvailable(): Promise<boolean> {
    const module = await this.loadNativeModule();
    if (!module) return false;
    return module.isSupported();
  }

  /**
   * Set callback for microphone audio level updates.
   */
  onMicLevel(callback: AudioLevelCallback): void {
    this.micLevelCallback = callback;
  }

  /**
   * Set callback for system audio level updates.
   */
  onSystemLevel(callback: AudioLevelCallback): void {
    this.systemLevelCallback = callback;
  }

  /**
   * Start synchronized audio capture.
   */
  async start(transcriptionProvider: ITranscriptionProvider): Promise<void> {
    if (this.capturing) {
      logger.warn('Already capturing');
      return;
    }

    this.transcriptionProvider = transcriptionProvider;

    // Try to load native module
    this.nativeModule = await this.loadNativeModule();

    if (!this.nativeModule) {
      throw new Error('Native audio module not available');
    }

    if (!this.nativeModule.isSupported()) {
      throw new Error('macOS 13.0+ required for synchronized audio capture');
    }

    logger.info('Starting synchronized audio capture');

    // Check if headphones are connected - skip AEC if so
    const headphoneDetector = new HeadphoneDetector();
    const headphonesConnected = await headphoneDetector.detect();
    const enableAEC = !headphonesConnected;

    logger.info('Audio output detection', { headphonesConnected, enableAEC });

    // Create capture instance
    this.handle = this.nativeModule.create({
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      chunkDurationMs: AUDIO_CONFIG.CHUNK_DURATION_MS,
      channels: AUDIO_CONFIG.CHANNELS,
      enableAEC,
      bypassAECOnHeadphones: true,
    });

    // Set callback
    this.nativeModule.setCallback(this.handle, (frame: SynchronizedAudioFrame) => {
      this.handleAudioFrame(frame);
    });

    // Start capture
    try {
      await this.nativeModule.start(this.handle);
      this.capturing = true;
      this.emit('start');
      logger.info('Synchronized audio capture started');
    } catch (error) {
      logger.error('Failed to start audio capture', error as Error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop audio capture.
   */
  async stop(): Promise<void> {
    if (!this.capturing) {
      return;
    }

    logger.info('Stopping synchronized audio capture');

    this.capturing = false;

    if (this.nativeModule && this.handle !== null) {
      try {
        this.nativeModule.stop(this.handle);
        this.nativeModule.destroy(this.handle);
      } catch (error) {
        logger.error('Error stopping native capture', error as Error);
      }
    }

    this.cleanup();
    this.emit('stop');
  }

  /**
   * Check if currently capturing.
   */
  isCapturing(): boolean {
    return this.capturing;
  }

  /**
   * Handle incoming synchronized audio frame.
   */
  private handleAudioFrame(frame: SynchronizedAudioFrame): void {
    if (!this.capturing || !this.transcriptionProvider) {
      return;
    }

    // Send mic audio to transcription
    if (frame.hasMic && frame.mic) {
      const arrayBuffer = this.bufferToArrayBuffer(frame.mic);
      this.transcriptionProvider.sendAudio(arrayBuffer, 'mic');

      if (this.micLevelCallback) {
        this.micLevelCallback(frame.micLevel);
      }
    }

    // Send system audio to transcription
    if (frame.hasSystem && frame.system) {
      const arrayBuffer = this.bufferToArrayBuffer(frame.system);
      this.transcriptionProvider.sendAudio(arrayBuffer, 'system');

      if (this.systemLevelCallback) {
        this.systemLevelCallback(frame.systemLevel);
      }
    }
  }

  /**
   * Convert Node.js Buffer to ArrayBuffer.
   */
  private bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    const uint8Array = new Uint8Array(buffer);
    return uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength
    );
  }

  /**
   * Load the native audio module.
   */
  private async loadNativeModule(): Promise<NativeAudioModule | null> {
    if (this.nativeModule) {
      return this.nativeModule;
    }

    const modulePaths = this.getNativeModulePaths();

    for (const path of modulePaths) {
      try {
        const { existsSync } = await import('fs');
        if (!existsSync(path)) {
          continue;
        }

        logger.debug('Trying to load native audio module', { path });
        const module = require(path) as NativeAudioModule;
        logger.info('Native audio module loaded', { path });
        return module;
      } catch (error) {
        logger.debug('Failed to load native module from path', {
          path,
          error: (error as Error).message,
        });
      }
    }

    logger.warn('Native audio module not found', { searchedPaths: modulePaths });
    return null;
  }

  /**
   * Get list of paths to search for the native module.
   */
  private getNativeModulePaths(): string[] {
    const { join } = require('path');
    const paths: string[] = [];

    // Production: resources directory
    if (process.resourcesPath) {
      paths.push(join(process.resourcesPath, 'native', 'kakarot-audio.node'));
    }

    // Development: build directory
    try {
      const { app } = require('electron');
      const appPath = app.getAppPath();
      paths.push(join(appPath, 'native', 'kakarot-audio', 'build', 'Release', 'kakarot_audio.node'));
      paths.push(join(appPath, '..', 'native', 'kakarot-audio', 'build', 'Release', 'kakarot_audio.node'));
    } catch {
      // Not in Electron context
    }

    // CWD-relative paths
    paths.push(join(process.cwd(), 'native', 'kakarot-audio', 'build', 'Release', 'kakarot_audio.node'));

    return paths;
  }

  /**
   * Cleanup resources.
   */
  private cleanup(): void {
    this.handle = null;
    this.nativeModule = null;
    this.transcriptionProvider = null;
    this.micLevelCallback = null;
    this.systemLevelCallback = null;
  }
}
