import { BaseAudioProcessor, AudioProcessorConfig } from './IAudioProcessor';
import { HeadphoneDetector } from '../HeadphoneDetector';
import { createLogger } from '@main/core/logger';
import { AEC_CONFIG } from '@main/config/constants';
import type { IReferenceAudioReceiver } from '../../../services/SystemAudioService';

const logger = createLogger('AECProcessor');

/**
 * Native AEC module interface.
 * This maps to the Rust Neon module exports using WebRTC's AudioProcessing.
 */
interface NativeAECModule {
  create(sampleRate: number, numChannels?: number): NativeAECHandle;
  feedReference(handle: NativeAECHandle, buffer: Buffer): void;
  process(handle: NativeAECHandle, buffer: Buffer): Buffer;
  getMetrics(handle: NativeAECHandle): { totalFrames: number; processingTimeUs: number };
  reset(handle: NativeAECHandle): void;
}

interface NativeAECHandle {
  _opaque: unknown;
}

/**
 * Configuration for the AEC processor.
 */
export interface AECConfig {
  /** Number of audio channels (default: 1 for mono). */
  numChannels: number;
  /** Whether to auto-bypass when headphones are detected. */
  headphoneBypass: boolean;
}

const DEFAULT_AEC_CONFIG: AECConfig = {
  numChannels: 1,
  headphoneBypass: true,
};

/**
 * Acoustic Echo Cancellation processor.
 * Uses mic audio as reference signal to remove echo from system audio.
 */
export class AECProcessor extends BaseAudioProcessor implements IReferenceAudioReceiver {
  public readonly name = 'AEC';

  private aecConfig: AECConfig;
  private nativeModule: NativeAECModule | null = null;
  private nativeHandle: NativeAECHandle | null = null;
  private hasReceivedReference: boolean = false;
  private headphoneDetector: HeadphoneDetector;

  constructor(config?: Partial<AECConfig>) {
    super();
    this.aecConfig = { ...DEFAULT_AEC_CONFIG, ...config };
    this.headphoneDetector = new HeadphoneDetector();
  }

  async initialize(audioConfig: AudioProcessorConfig): Promise<void> {
    this.config = audioConfig;
    logger.info('Initializing AEC processor', {
      audioConfig,
      aecConfig: this.aecConfig,
    });

    // Check headphones first
    if (this.aecConfig.headphoneBypass) {
      const hasHeadphones = await this.headphoneDetector.detect();
      if (hasHeadphones) {
        logger.info('Headphones detected - bypassing AEC');
        this.bypass('Headphones connected');
        return;
      }
    }

    // Try to load native module
    const loaded = await this.loadNativeModule();
    if (!loaded) {
      this.bypass('Native module unavailable');
      return;
    }

    // Initialize the native AEC engine (WebRTC AudioProcessing)
    try {
      this.nativeHandle = this.nativeModule!.create(
        audioConfig.sampleRate,
        this.aecConfig.numChannels
      );
      this.active = true;
      logger.info('AEC processor initialized successfully (WebRTC AEC3)');
    } catch (error) {
      logger.error('Failed to create AEC instance', error as Error);
      this.bypass('Failed to initialize AEC engine');
    }
  }

  protected async processInternal(chunk: Buffer, _timestamp: number): Promise<Buffer> {
    if (!this.nativeModule || !this.nativeHandle) {
      return chunk;
    }

    // Wait until we've received at least some reference audio
    // The Rust buffer handles synchronization via FIFO ordering
    if (!this.hasReceivedReference) {
      return chunk;
    }

    try {
      const processed = this.nativeModule.process(this.nativeHandle, chunk);

      // Emit metrics periodically
      const metrics = this.nativeModule.getMetrics(this.nativeHandle);
      if (metrics.totalFrames % AEC_CONFIG.METRICS_INTERVAL_FRAMES === 0) {
        this.emit('metrics', {
          totalFrames: metrics.totalFrames,
          avgProcessingTimeUs: metrics.processingTimeUs / Math.max(1, metrics.totalFrames),
        });
      }

      return processed;
    } catch (error) {
      logger.error('AEC processing failed', error as Error);
      return chunk;
    }
  }

  /**
   * Feed reference (system/speaker) audio to the AEC processor.
   * This is the audio playing through speakers that might create echo.
   * Called from SystemAudioService when system audio is captured.
   */
  feedReference(chunk: Buffer, _timestamp: number): void {
    if (!this.active || this.bypassed) {
      return;
    }

    // Feed to native module for internal buffering
    // Rust handles synchronization via FIFO ordering
    if (this.nativeModule && this.nativeHandle) {
      try {
        this.nativeModule.feedReference(this.nativeHandle, chunk);
        this.hasReceivedReference = true;
      } catch (error) {
        logger.error('Failed to feed reference', error as Error);
      }
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up AEC processor');

    if (this.nativeModule && this.nativeHandle) {
      try {
        this.nativeModule.reset(this.nativeHandle);
      } catch (error) {
        logger.error('Error resetting AEC', error as Error);
      }
    }

    this.nativeHandle = null;
    this.nativeModule = null;
    this.hasReceivedReference = false;
    this.active = false;
  }

  /**
   * Attempt to load the native AEC module.
   * Returns true if successful, false otherwise.
   */
  private async loadNativeModule(): Promise<boolean> {
    const modulePaths = this.getNativeModulePaths();

    for (const path of modulePaths) {
      try {
        // Check if file exists
        const { existsSync } = await import('fs');
        if (!existsSync(path)) {
          continue;
        }

        logger.debug('Trying to load native AEC module', { path });
        this.nativeModule = require(path) as NativeAECModule;
        logger.info('Native AEC module loaded', { path });
        return true;
      } catch (error) {
        logger.debug('Failed to load native module from path', {
          path,
          error: (error as Error).message,
        });
      }
    }

    logger.warn('Native AEC module not found', {
      searchedPaths: modulePaths,
    });
    return false;
  }

  /**
   * Get list of paths to search for the native module.
   */
  private getNativeModulePaths(): string[] {
    const { join } = require('path');
    const paths: string[] = [];

    // Production: resources directory
    if (process.resourcesPath) {
      paths.push(join(process.resourcesPath, 'native', 'kakarot-aec.node'));
    }

    // Development: node_modules
    try {
      const { app } = require('electron');
      const appPath = app.getAppPath();
      paths.push(join(appPath, 'native', 'kakarot-aec', 'index.node'));
      paths.push(join(appPath, '..', 'native', 'kakarot-aec', 'index.node'));
    } catch {
      // Not in Electron context (tests)
    }

    // CWD-relative paths
    paths.push(join(process.cwd(), 'native', 'kakarot-aec', 'index.node'));
    paths.push(join(process.cwd(), 'native', 'kakarot-aec', 'build', 'Release', 'index.node'));

    return paths;
  }
}
