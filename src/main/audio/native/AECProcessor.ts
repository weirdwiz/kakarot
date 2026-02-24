/**
 * WebRTC Acoustic Echo Cancellation (AEC) Processor
 *
 * Wraps the native C++ audio_capture_native.node module to provide
 * real-time echo cancellation for microphone audio using WebRTC AEC3.
 *
 * Architecture:
 * - Render path: System audio (speakers) → processRenderAudio() → AEC reference
 * - Capture path: Microphone audio → processCaptureAudio() → Echo-cancelled output
 * - Native mic capture: AudioUnit capture → Shared timestamp source → Perfect sync!
 *
 * The AEC requires render audio to be processed BEFORE corresponding capture audio
 * for optimal echo suppression.
 */

import bindings from 'bindings';
import { createLogger } from '@main/core/logger';

const logger = createLogger('AECProcessor');

/**
 * Configuration options for AEC initialization
 */
export interface AECConfig {
  /** Enable acoustic echo cancellation (default: true) */
  enableAec?: boolean;

  /** Enable noise suppression (default: true) */
  enableNs?: boolean;

  /** Enable automatic gain control (default: false) */
  enableAgc?: boolean;

  /** Disable AEC when headphones are detected (default: true) */
  disableAecOnHeadphones?: boolean;

  /** Frame duration in milliseconds: 10, 20, or 30 (default: 10) */
  frameDurationMs?: 10 | 20 | 30;

  /** Sample rate in Hz (default: 48000) */
  sampleRate?: number;
}

/**
 * AEC metrics from the native module
 */
export interface AECMetrics {
  /** Echo return loss enhancement in dB */
  erle?: number;

  /** Residual echo return loss in dB */
  rerl?: number;

  /** Echo suppression strength (0-1) */
  echoPower?: number;

  /** Current residual echo level */
  residualEchoLevel?: number;

  /** Whether AEC is currently processing */
  isProcessing?: boolean;

  /** Render delay estimate in milliseconds */
  renderDelayMs?: number;

  /** Number of render buffers queued */
  renderQueueSize?: number;

  /** Convergence status */
  converged?: boolean;
}

/** Native AudioCaptureAddon instance interface */
interface NativeAudioAddon {
  processRenderAudio(buffer: Float32Array): void;
  processCaptureAudio(buffer: Float32Array): Float32Array;
  startMicrophoneCapture(callback: (samples: Float32Array, timestamp: number) => void): boolean;
  stopMicrophoneCapture(): boolean;
  getMetrics(): Record<string, unknown>;
  isHeadphonesConnected(): boolean;
  setEchoCancellationEnabled(enabled: boolean): void;
  resetAEC(): void;
}

/**
 * Load the native audio_capture_native module, trying bindings first
 * then falling back to direct require at known paths.
 */
function loadNativeModule(): {
  AudioCaptureAddon: new (config: Record<string, boolean>) => NativeAudioAddon;
} {
  try {
    const mod = bindings('audio_capture_native') as {
      AudioCaptureAddon?: new (config: Record<string, boolean>) => NativeAudioAddon;
    };
    if (mod?.AudioCaptureAddon)
      return mod as {
        AudioCaptureAddon: new (config: Record<string, boolean>) => NativeAudioAddon;
      };
  } catch {
    // bindings() failed, fall through to path search
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');

  const possiblePaths = [
    path.join(__dirname, 'audio_capture_native.node'),
    path.join(process.cwd(), 'native/build/Release/audio_capture_native.node'),
    path.join(process.cwd(), 'build/Release/audio_capture_native.node'),
    path.join(process.cwd(), 'audio_capture_native.node'),
  ];

  if (process.resourcesPath) {
    possiblePaths.push(
      path.join(process.resourcesPath, 'app/native/build/Release/audio_capture_native.node'),
      path.join(process.resourcesPath, 'native/build/Release/audio_capture_native.node'),
      path.join(process.resourcesPath, 'app/audio_capture_native.node'),
      path.join(process.resourcesPath, 'audio_capture_native.node')
    );
  }

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        logger.info('Found native addon', { path: testPath });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(testPath);
        if (mod?.AudioCaptureAddon) return mod;
      }
    } catch {
      // skip invalid paths
    }
  }

  throw new Error('Could not find native audio_capture_native module');
}

const DEFAULT_CONFIG: Required<AECConfig> = {
  enableAec: true,
  enableNs: true,
  enableAgc: false,
  disableAecOnHeadphones: true,
  frameDurationMs: 10,
  sampleRate: 48000,
};

/**
 * TypeScript wrapper for the native WebRTC AEC module.
 * Manages render/capture processing and native mic capture.
 */
export class AECProcessor {
  private nativeInstance: NativeAudioAddon | null = null;
  private config: Required<AECConfig>;
  private isInitialized = false;
  private isDestroyed = false;
  private micCapturing = false;
  private micAudioCallback?: (samples: Float32Array, timestamp: number) => void;

  constructor(config: AECConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    try {
      const nativeModule = loadNativeModule();

      this.nativeInstance = new nativeModule.AudioCaptureAddon({
        enableAec: this.config.enableAec,
        enableNs: this.config.enableNs,
        enableAgc: this.config.enableAgc,
      });

      this.isInitialized = true;
      logger.info('AEC initialized successfully', {
        enableAec: this.config.enableAec,
        enableNs: this.config.enableNs,
        enableAgc: this.config.enableAgc,
        sampleRate: this.config.sampleRate,
        frameDurationMs: this.config.frameDurationMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('AEC initialization failed', {
        errorMessage: message,
        errorType: error instanceof Error ? 'Error' : 'Other',
      });
      throw new Error(`AEC initialization failed: ${message}`);
    }
  }

  /**
   * Process render (system/speaker) audio through the AEC reference path.
   * Must be called BEFORE corresponding processCaptureAudio() call.
   */
  public processRenderAudio(renderBuffer: Float32Array): boolean {
    if (!this.isReady() || !this.nativeInstance) return false;
    if (!renderBuffer || renderBuffer.length === 0) return false;

    try {
      this.nativeInstance.processRenderAudio(renderBuffer);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error processing render audio', { error: message });
      return false;
    }
  }

  /**
   * Process capture (microphone) audio through the AEC to remove echo.
   * Returns echo-cancelled audio, or null on error.
   */
  public processCaptureAudio(captureBuffer: Float32Array): Float32Array | null {
    if (!this.isReady() || !this.nativeInstance) return null;
    if (!captureBuffer || captureBuffer.length === 0) return null;

    try {
      return this.nativeInstance.processCaptureAudio(captureBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error processing capture audio', { error: message });
      return null;
    }
  }

  /**
   * Start native microphone capture using AudioUnit.
   * Timestamps use the same monotonic clock as system audio for AEC sync.
   */
  public startMicrophoneCapture(
    callback: (samples: Float32Array, timestamp: number) => void
  ): boolean {
    if (!this.isReady() || !this.nativeInstance) return false;
    if (this.micCapturing) return true;

    try {
      this.micAudioCallback = callback;

      const success = this.nativeInstance.startMicrophoneCapture(
        (samples: Float32Array, timestamp: number) => {
          this.micAudioCallback?.(samples, timestamp);
        }
      );

      if (success) {
        this.micCapturing = true;
        logger.info('Native microphone capture started');
        return true;
      }

      logger.error('Native module failed to start microphone capture');
      this.micAudioCallback = undefined;
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error starting native microphone capture', { error: message });
      this.micAudioCallback = undefined;
      return false;
    }
  }

  /**
   * Stop native microphone capture.
   */
  public stopMicrophoneCapture(): boolean {
    if (!this.micCapturing || !this.nativeInstance) return true;

    try {
      const success = this.nativeInstance.stopMicrophoneCapture();
      if (success) {
        this.micCapturing = false;
        this.micAudioCallback = undefined;
        logger.info('Native microphone capture stopped');
      }
      return success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error stopping native microphone capture', { error: message });
      return false;
    }
  }

  /**
   * Check if native microphone capture is running.
   */
  public isMicrophoneCapturing(): boolean {
    return this.micCapturing;
  }

  /**
   * Get current AEC metrics (ERLE, residual echo level, convergence status).
   */
  public getMetrics(): AECMetrics {
    if (!this.isReady() || !this.nativeInstance) return {};

    try {
      const m = this.nativeInstance.getMetrics();
      return {
        erle:
          typeof m.echoReturnLossEnhancement === 'number' ? m.echoReturnLossEnhancement : undefined,
        rerl: typeof m.echoReturnLoss === 'number' ? m.echoReturnLoss : undefined,
        renderDelayMs: typeof m.renderDelayMs === 'number' ? m.renderDelayMs : undefined,
        converged: typeof m.aecConverged === 'boolean' ? m.aecConverged : undefined,
        echoPower: typeof m.rmsLevel === 'number' ? m.rmsLevel : undefined,
        residualEchoLevel: typeof m.peakLevel === 'number' ? m.peakLevel : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to get AEC metrics', { error: message });
      return {};
    }
  }

  public isHeadphonesConnected(): boolean {
    if (!this.isReady() || !this.nativeInstance) return false;

    try {
      return this.nativeInstance.isHeadphonesConnected();
    } catch {
      return false;
    }
  }

  public setEchoCancellationEnabled(enabled: boolean): void {
    if (!this.isReady() || !this.nativeInstance) return;

    try {
      this.nativeInstance.setEchoCancellationEnabled(enabled);
      logger.info('AEC enabled state changed', { enabled });
    } catch (error) {
      logger.warn('Failed to set AEC enabled state', { error });
    }
  }

  public reset(): void {
    if (!this.isReady() || !this.nativeInstance) return;

    try {
      this.nativeInstance.resetAEC();
      logger.info('AEC state reset');
    } catch (error) {
      logger.warn('Failed to reset AEC state', { error });
    }
  }

  /**
   * Clean up and destroy the AEC processor. Call when no longer needed.
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    if (this.micCapturing) {
      this.stopMicrophoneCapture();
    }

    this.isInitialized = false;
    this.isDestroyed = true;
    this.micAudioCallback = undefined;
    this.nativeInstance = null;

    logger.info('AEC processor destroyed');
  }

  /**
   * Check if the processor is initialized and ready to use
   */
  public isReady(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Readonly<Required<AECConfig>> {
    return { ...this.config };
  }
}

/**
 * Convert Float32Array audio samples to Int16Array (16-bit PCM).
 */
export function float32ToInt16Array(float32Samples: Float32Array): Int16Array {
  const int16Samples = new Int16Array(float32Samples.length);
  for (let i = 0; i < float32Samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Samples[i]));
    int16Samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16Samples;
}

/**
 * Convert Float32Array audio samples to ArrayBuffer in Int16 format.
 */
export function float32ToInt16Buffer(float32Samples: Float32Array): ArrayBuffer {
  const int16Samples = float32ToInt16Array(float32Samples);
  return int16Samples.buffer as ArrayBuffer;
}
