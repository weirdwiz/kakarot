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

const DEFAULT_CONFIG: Required<AECConfig> = {
  enableAec: true,
  enableNs: true,
  enableAgc: false,
  disableAecOnHeadphones: true,
  frameDurationMs: 10,
  sampleRate: 48000,
};

/**
 * TypeScript wrapper for the native WebRTC AEC module
 *
 * Manages initialization, render/capture processing, native mic capture, and cleanup
 * of the WebRTC echo cancellation pipeline.
 *
 * @example
 * ```typescript
 * const aec = new AECProcessor({
 *   enableAec: true,
 *   enableNs: true,
 *   enableAgc: false,
 *   disableAecOnHeadphones: true,
 *   frameDurationMs: 10,
 * });
 *
 * // Option 1: Use native mic capture (recommended - perfect timestamps!)
 * aec.startMicrophoneCapture((samples, timestamp) => {
 *   console.log('Native mic audio:', samples.length, 'timestamp:', timestamp);
 *   // Process with AEC, send to transcription, etc.
 * });
 *
 * // Option 2: Manual processing (if using renderer mic capture)
 * // Feed system audio (what speakers play)
 * aec.processRenderAudio(systemBuffer);
 *
 * // Process microphone audio (returns echo-cancelled)
 * const cleanAudio = aec.processCaptureAudio(micBuffer);
 *
 * // Send cleanAudio to transcription
 * await transcriptionProvider.sendAudio(cleanAudio, 'mic');
 *
 * // Optionally log metrics
 * const metrics = aec.getMetrics();
 * console.log('ERLE:', metrics.erle, 'dB');
 *
 * // Cleanup
 * aec.destroy();
 * ```
 */
export class AECProcessor {
  private nativeModule: any = null;
  private nativeInstance: any = null;
  private config: Required<AECConfig>;
  private isInitialized = false;
  private isDestroyed = false;
  private renderBufferQueue: Float32Array[] = [];
  private readonly MAX_RENDER_QUEUE = 10;
  
  // NEW: Native mic capture state
  private micCapturing = false;
  private micAudioCallback?: (samples: Float32Array, timestamp: number) => void;

  constructor(config: AECConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    try {
      // Load the native module (exports a class AudioCaptureAddon)
      let nativeModule;
      
      try {
        // First try: use bindings module (works in dev/unbundled)
        logger.debug('Attempting to load native addon via bindings module...');
          logger.debug('DEBUG:', { __dirname, cwd: process.cwd() });
        nativeModule = bindings('audio_capture_native');
        logger.debug('✅ Loaded native addon via bindings module');
      } catch (bindingsError) {
        // Fallback: try to require directly at runtime using multiple possible paths
        const fs = require('fs');
        const path = require('path');
        
        const errorMsg = bindingsError instanceof Error ? bindingsError.message : String(bindingsError);
        logger.debug('⚠️  bindings() failed, trying direct require paths', { error: errorMsg.substring(0, 100) });
        
        const possiblePaths: string[] = [];
        
        // Try same directory as the bundled code (after build copy)
        possiblePaths.push(
          path.join(__dirname, 'audio_capture_native.node')
        );
        
        // Try absolute dev paths
        possiblePaths.push(
          path.resolve('/Users/moxo/Desktop/kakarot-master/native/build/Release/audio_capture_native.node'),
          path.resolve('/Users/moxo/Desktop/kakarot-master/build/Release/audio_capture_native.node')
        );
        
        // Try cwd-relative paths
        possiblePaths.push(
          path.join(process.cwd(), 'native/build/Release/audio_capture_native.node'),
          path.join(process.cwd(), 'build/Release/audio_capture_native.node'),
          path.join(process.cwd(), 'audio_capture_native.node')
        );
        
        // Try relative to app directory (for production)
        if (process.resourcesPath) {
          possiblePaths.push(
            path.join(process.resourcesPath, 'app/native/build/Release/audio_capture_native.node'),
            path.join(process.resourcesPath, 'native/build/Release/audio_capture_native.node'),
            path.join(process.resourcesPath, 'app/audio_capture_native.node'),
            path.join(process.resourcesPath, 'audio_capture_native.node')
          );
        }

        let foundPath: string | null = null;
        const checkedPaths: string[] = [];
        
        for (const testPath of possiblePaths) {
          checkedPaths.push(testPath);
          try {
            if (fs.existsSync(testPath)) {
              logger.info('✅ Found native addon', { path: testPath });
              foundPath = testPath;
              break;
            }
          } catch (e) {
            logger.debug('Path check failed', { path: testPath, error: String(e).substring(0, 50) });
          }
        }

        if (!foundPath) {
          const checkedStr = checkedPaths.slice(0, 2).join(' OR ');
          throw new Error(
            `Could not find native audio_capture_native module. Checked: ${checkedStr}`
          );
        }

        logger.debug('Loading native addon using require()', { path: foundPath });
        nativeModule = require(foundPath);
        logger.debug('✅ Loaded native addon via direct require()');
      }

      if (!nativeModule || typeof nativeModule.AudioCaptureAddon !== 'function') {
        logger.error('Invalid native module structure', { hasModule: !!nativeModule, hasAudioCaptureAddon: !!nativeModule?.AudioCaptureAddon });
        throw new Error('Failed to load native audio_capture_native module');
      }

      this.nativeModule = nativeModule;

      // Create native instance with config (init occurs in constructor)
      logger.debug('Creating native AudioCaptureAddon instance...');
      this.nativeInstance = new this.nativeModule.AudioCaptureAddon({
        enableAec: this.config.enableAec,
        enableNs: this.config.enableNs,
        enableAgc: this.config.enableAgc,
      });

      this.isInitialized = true;
      logger.info('✅ AEC initialized successfully', {
        enableAec: this.config.enableAec,
        enableNs: this.config.enableNs,
        enableAgc: this.config.enableAgc,
        sampleRate: this.config.sampleRate,
        frameDurationMs: this.config.frameDurationMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('❌ AEC initialization failed', { errorMessage: message, errorType: error instanceof Error ? 'Error' : 'Other' });
      throw new Error(`AEC initialization failed: ${message}`);
    }
  }

  /**
   * Initialize the AEC pipeline in the native module
   * @private
   */
  private initializeAEC(): void {
    // No-op: initialization occurs when creating nativeInstance in constructor
    if (this.isInitialized) return;
  }

  /**
   * Process render (system/speaker) audio through the AEC reference path
   *
   * Must be called for system audio BEFORE corresponding microphone audio
   * is processed through processCaptureAudio(). This tells the AEC what
   * signal is being played to the speakers so it can be removed from the
   * microphone signal.
   *
   * @param renderBuffer - Float32Array of system audio samples (-1.0 to 1.0)
   * @returns Success flag
   * @throws Error if AEC is not initialized or destroyed
   *
   * @example
   * ```typescript
   * // When system audio arrives
   * const systemAudio = await getSystemAudio();
   * aec.processRenderAudio(systemAudio);
   * // Then later, when mic audio arrives
   * const cleanMic = aec.processCaptureAudio(micAudio);
   * ```
   */
  public processRenderAudio(renderBuffer: Float32Array): boolean {
    if (this.isDestroyed) {
      logger.warn('Cannot process render audio: AEC processor is destroyed');
      return false;
    }

    if (!this.isInitialized) {
      logger.warn('Cannot process render audio: AEC not initialized');
      return false;
    }

    if (!renderBuffer || renderBuffer.length === 0) {
      logger.warn('Render buffer is empty, skipping');
      return false;
    }

    try {
      // Queue the render buffer for processing
      // The native module will process it internally and use it as reference
      // for the next processCaptureAudio call
      if (this.nativeInstance && typeof this.nativeInstance.processRenderAudio === 'function') {
        this.nativeInstance.processRenderAudio(renderBuffer);
      }

      // Keep a reference for metrics if needed
      if (this.renderBufferQueue.length >= this.MAX_RENDER_QUEUE) {
        this.renderBufferQueue.shift();
      }
      this.renderBufferQueue.push(renderBuffer);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error processing render audio', { error: message });
      return false;
    }
  }

  /**
   * Process capture (microphone) audio through the AEC to remove echo
   *
   * Returns echo-cancelled microphone audio suitable for transcription.
   * Should only be called after render audio has been processed via
   * processRenderAudio() for the corresponding far-end signal.
   *
   * @param captureBuffer - Float32Array of microphone audio samples (-1.0 to 1.0)
   * @returns Processed (echo-cancelled) audio as Float32Array, or null on error
   * @throws Error if AEC is not initialized or destroyed
   *
   * @example
   * ```typescript
   * // When microphone audio arrives
   * try {
   *   const cleanAudio = aec.processCaptureAudio(micBuffer);
   *   if (cleanAudio) {
   *     // Send clean audio to transcription
   *     const pcmBuffer = float32ToInt16(cleanAudio);
   *     await transcriptionProvider.sendAudio(pcmBuffer, 'mic');
   *   } else {
   *     // Fall back to raw audio if processing failed
   *     const pcmBuffer = float32ToInt16(micBuffer);
   *     await transcriptionProvider.sendAudio(pcmBuffer, 'mic');
   *   }
   * } catch (error) {
   *   logger.error('AEC processing failed, using raw mic', { error });
   *   const pcmBuffer = float32ToInt16(micBuffer);
   *   await transcriptionProvider.sendAudio(pcmBuffer, 'mic');
   * }
   * ```
   */
  public processCaptureAudio(captureBuffer: Float32Array): Float32Array | null {
    if (this.isDestroyed) {
      logger.warn('Cannot process capture audio: AEC processor is destroyed');
      return null;
    }

    if (!this.isInitialized) {
      logger.warn('Cannot process capture audio: AEC not initialized');
      return null;
    }

    if (!captureBuffer || captureBuffer.length === 0) {
      logger.warn('Capture buffer is empty, returning null');
      return null;
    }

    try {
      // Call the native module to process capture audio and return echo-cancelled result
      if (this.nativeInstance && typeof this.nativeInstance.processCaptureAudio === 'function') {
        const result = this.nativeInstance.processCaptureAudio(captureBuffer);
        return result as Float32Array;
      }

      logger.warn('processCaptureAudio not available in native module');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error processing capture audio', { error: message });
      return null;
    }
  }

  /**
   * NEW: Start native microphone capture using AudioUnit
   * 
   * This captures mic audio directly in the main process using the SAME
   * timestamp source as system audio, ensuring perfect synchronization!
   * 
   * Timestamps are in milliseconds and use the same monotonic clock as
   * system audio, so they can be matched with 50-100ms tolerance for AEC sync.
   *
   * @param callback - Called with mic audio samples and timestamp
   * @returns Success flag
   * 
   * @example
   * ```typescript
   * const success = aec.startMicrophoneCapture((samples, timestamp) => {
   *   console.log('Native mic:', samples.length, 'samples at', timestamp, 'ms');
   *   
   *   // Find matching system audio in your buffer
   *   const systemAudio = findSystemAudioNearTimestamp(timestamp);
   *   
   *   if (systemAudio) {
   *     // Perfect sync! Process in order:
   *     aec.processRenderAudio(systemAudio.samples);  // Step 1: Feed echo reference
   *     const clean = aec.processCaptureAudio(samples); // Step 2: Remove echo
   *     
   *     // Send to transcription
   *     await transcription.sendAudio(clean, 'mic');
   *   }
   * });
   * 
   * if (!success) {
   *   console.error('Failed to start native mic capture');
   * }
   * ```
   */
  public startMicrophoneCapture(callback: (samples: Float32Array, timestamp: number) => void): boolean {
    if (this.isDestroyed) {
      logger.warn('Cannot start mic capture: AEC processor is destroyed');
      return false;
    }

    if (!this.isInitialized) {
      logger.warn('Cannot start mic capture: AEC not initialized');
      return false;
    }

    if (this.micCapturing) {
      logger.warn('Microphone capture already running');
      return true;
    }

    if (!callback || typeof callback !== 'function') {
      logger.error('Invalid callback provided to startMicrophoneCapture');
      return false;
    }

    try {
      this.micAudioCallback = callback;

      if (this.nativeInstance && typeof this.nativeInstance.startMicrophoneCapture === 'function') {
        const success = this.nativeInstance.startMicrophoneCapture((samples: Float32Array, timestamp: number) => {
          if (this.micAudioCallback) {
            this.micAudioCallback(samples, timestamp);
          }
        });

        if (success) {
          this.micCapturing = true;
          logger.info('✅ Native microphone capture started (same clock as system audio!)');
          return true;
        } else {
          logger.error('Native module failed to start microphone capture');
          this.micAudioCallback = undefined;
          return false;
        }
      } else {
        logger.error('startMicrophoneCapture not available in native module');
        this.micAudioCallback = undefined;
        return false;
      }
    } catch (error) {
      // Better error extraction for debugging
      let errorMsg = 'Unknown error';
      let errorStack = '';
      if (error instanceof Error) {
        errorMsg = error.message;
        errorStack = error.stack || '';
      } else if (typeof error === 'object' && error !== null) {
        errorMsg = JSON.stringify(error);
      } else {
        errorMsg = String(error);
      }
      
      logger.error('Error starting native microphone capture', { 
        error: errorMsg,
        stack: errorStack,
        errorType: typeof error,
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : []
      });
      this.micAudioCallback = undefined;
      return false;
    }
  }

  /**
   * NEW: Stop native microphone capture
   * 
   * @returns Success flag
   * 
   * @example
   * ```typescript
   * aec.stopMicrophoneCapture();
   * ```
   */
  public stopMicrophoneCapture(): boolean {
    if (!this.micCapturing) {
      return true;
    }

    try {
      if (this.nativeInstance && typeof this.nativeInstance.stopMicrophoneCapture === 'function') {
        const success = this.nativeInstance.stopMicrophoneCapture();
        
        if (success) {
          this.micCapturing = false;
          this.micAudioCallback = undefined;
          logger.info('🛑 Native microphone capture stopped');
          return true;
        } else {
          logger.warn('Native module failed to stop microphone capture');
          return false;
        }
      } else {
        logger.warn('stopMicrophoneCapture not available in native module');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error stopping native microphone capture', { error: message });
      return false;
    }
  }

  /**
   * NEW: Check if native microphone capture is running
   * 
   * @returns True if mic is currently capturing
   */
  public isMicrophoneCapturing(): boolean {
    return this.micCapturing;
  }

  /**
   * Get current AEC metrics and performance statistics
   *
   * Useful for logging, debugging, and monitoring echo suppression quality.
   * Metrics include echo return loss enhancement (ERLE), residual echo level,
   * and convergence status.
   *
   * @returns Object containing AEC metrics, or empty object if unavailable
   *
   * @example
   * ```typescript
   * const metrics = aec.getMetrics();
   * if (metrics.erle !== undefined) {
   *   console.log(`Echo suppression: ${metrics.erle} dB`);
   *   if (metrics.erle > 10) {
   *     console.log('✅ Good echo cancellation performance');
   *   }
   * }
   * ```
   */
  public getMetrics(): AECMetrics {
    if (!this.isInitialized || this.isDestroyed) {
      return {};
    }

    try {
      if (this.nativeInstance && typeof this.nativeInstance.getMetrics === 'function') {
        const m = this.nativeInstance.getMetrics() as any;
        // Map native keys to AECMetrics interface
        const mapped: AECMetrics = {
          erle: typeof m.echoReturnLossEnhancement === 'number' ? m.echoReturnLossEnhancement : undefined,
          rerl: typeof m.echoReturnLoss === 'number' ? m.echoReturnLoss : undefined,
          renderDelayMs: typeof m.renderDelayMs === 'number' ? m.renderDelayMs : undefined,
          converged: typeof m.aecConverged === 'boolean' ? m.aecConverged : undefined,
          echoPower: typeof m.rmsLevel === 'number' ? m.rmsLevel : undefined,
          residualEchoLevel: typeof m.peakLevel === 'number' ? m.peakLevel : undefined,
        };
        return mapped;
      }
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to get AEC metrics', { error: message });
      return {};
    }
  }

  /**
   * Check if headphones are currently connected
   *
   * Can be used to conditionally disable AEC or adjust processing parameters.
   *
   * @returns True if headphones are detected, false otherwise
   */
  public isHeadphonesConnected(): boolean {
    if (!this.isInitialized || this.isDestroyed) {
      return false;
    }

    try {
      if (this.nativeInstance && typeof this.nativeInstance.isHeadphonesConnected === 'function') {
        return this.nativeInstance.isHeadphonesConnected() as boolean;
      }
      return false;
    } catch (error) {
      logger.warn('Failed to check headphone status', { error });
      return false;
    }
  }

  /**
   * Enable or disable echo cancellation at runtime
   *
   * @param enabled - Whether to enable AEC processing
   */
  public setEchoCancellationEnabled(enabled: boolean): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    try {
      if (this.nativeInstance && typeof this.nativeInstance.setEchoCancellationEnabled === 'function') {
        this.nativeInstance.setEchoCancellationEnabled(enabled);
        logger.info('AEC enabled set to:', { enabled });
      }
    } catch (error) {
      logger.warn('Failed to set AEC enabled state', { error });
    }
  }

  /**
   * Reset AEC state (useful between calls or for troubleshooting)
   */
  public reset(): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    try {
      if (this.nativeInstance && typeof this.nativeInstance.resetAEC === 'function') {
        this.nativeInstance.resetAEC();
      }
      this.renderBufferQueue = [];
      logger.info('AEC state reset');
    } catch (error) {
      logger.warn('Failed to reset AEC state', { error });
    }
  }

  /**
   * Clean up and destroy the AEC processor
   *
   * Must be called when the processor is no longer needed to release
   * native resources and prevent memory leaks.
   *
   * @example
   * ```typescript
   * // When stopping recording
   * aec.destroy();
   * aec = null;
   * ```
   */
  public destroy(): void {
    if (this.isDestroyed) {
      logger.warn('AEC processor already destroyed');
      return;
    }

    try {
      // Stop native mic capture if running
      if (this.micCapturing) {
        this.stopMicrophoneCapture();
      }

      // Native instance will be GC'd; just drop references
      this.renderBufferQueue = [];
      this.isInitialized = false;
      this.isDestroyed = true;
      this.micAudioCallback = undefined;
      this.nativeInstance = null;
      this.nativeModule = null;

      logger.info('✅ AEC processor destroyed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error destroying AEC processor', { error: message });
    }
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
 * Convert Float32Array audio samples to Int16Array (16-bit PCM)
 * for transmission to transcription services.
 *
 * @param float32Samples - Audio samples in range [-1.0, 1.0]
 * @returns Int16Array of PCM samples
 *
 * @example
 * ```typescript
 * const cleanAudio = aec.processCaptureAudio(micBuffer);
 * const pcmBuffer = float32ToInt16Array(cleanAudio);
 * await transcriptionProvider.sendAudio(pcmBuffer.buffer, 'mic');
 * ```
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
 * Convert Float32Array audio samples to ArrayBuffer in Int16 format
 *
 * @param float32Samples - Audio samples in range [-1.0, 1.0]
 * @returns ArrayBuffer containing int16 PCM data
 */
export function float32ToInt16Buffer(float32Samples: Float32Array): ArrayBuffer {
  const int16Samples = float32ToInt16Array(float32Samples);
  return int16Samples.buffer as ArrayBuffer;
}