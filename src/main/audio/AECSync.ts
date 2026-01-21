import { createLogger } from '@main/core/logger';
import type { AECProcessor } from './native/AECProcessor';

const logger = createLogger('AECSync');

interface BufferedAudio {
  samples: Float32Array;
  timestamp: number;
}

/**
 * Synchronizes render (system) and capture (mic) audio streams for WebRTC AEC.
 *
 * The AEC requires render audio to be processed BEFORE the corresponding capture audio.
 * This class buffers render audio and matches it with capture audio by timestamp.
 */
export class AECSync {
  private renderBuffer: BufferedAudio[] = [];
  private aecProcessor: AECProcessor;

  // Configuration
  private readonly BUFFER_SIZE_MS = 500;
  private readonly SYNC_TOLERANCE_MS = 300;
  private readonly MAX_BUFFER_ITEMS = 50;

  // Stats
  private totalProcessed = 0;
  private syncedProcessed = 0;
  private unsyncedProcessed = 0;

  constructor(aecProcessor: AECProcessor) {
    this.aecProcessor = aecProcessor;
    logger.info('AECSync initialized', {
      bufferMs: this.BUFFER_SIZE_MS,
      toleranceMs: this.SYNC_TOLERANCE_MS
    });
  }

  /**
   * Add render (system) audio to the buffer
   */
  addRenderAudio(samples: Float32Array, timestamp: number): void {
    this.renderBuffer.push({ samples: new Float32Array(samples), timestamp });

    // Trim old audio beyond buffer size
    const cutoffTime = timestamp - this.BUFFER_SIZE_MS;
    while (this.renderBuffer.length > 0 && this.renderBuffer[0].timestamp < cutoffTime) {
      this.renderBuffer.shift();
    }

    // Safety: prevent unbounded growth
    if (this.renderBuffer.length > this.MAX_BUFFER_ITEMS) {
      logger.warn('Render buffer overflow, trimming', {
        bufferLength: this.renderBuffer.length,
        maxItems: this.MAX_BUFFER_ITEMS
      });
      this.renderBuffer.shift();
    }
  }

  /**
   * Process capture (mic) audio with synchronized render audio
   *
   * This finds the matching render audio in the buffer and processes them in order:
   * 1. processRenderAudio() - Feed the echo reference
   * 2. processCaptureAudio() - Remove the echo
   */
  processCaptureWithSync(
    captureSamples: Float32Array,
    captureTimestamp: number
  ): Float32Array | null {
    this.totalProcessed++;

    if (!this.aecProcessor.isReady()) {
      logger.warn('AEC processor not ready');
      return null;
    }

    // Find matching render audio (within tolerance)
    // Look for render audio that's slightly older (mic picks up delayed echo)
    const matchingRender = this.renderBuffer.find(render => {
      const timeDiff = captureTimestamp - render.timestamp;
      return timeDiff >= 0 && timeDiff <= this.SYNC_TOLERANCE_MS;
    });

    if (matchingRender) {
      // SYNCHRONIZED PATH: Process in correct order
      this.syncedProcessed++;

      // Log occasionally for monitoring
      if (this.syncedProcessed % 100 === 0) {
        const syncRate = ((this.syncedProcessed / this.totalProcessed) * 100).toFixed(1);
        logger.debug('AEC sync stats', {
          total: this.totalProcessed,
          synced: this.syncedProcessed,
          unsynced: this.unsyncedProcessed,
          syncRate: `${syncRate}%`,
          bufferSize: this.renderBuffer.length
        });
      }

      // Step 1: Feed render audio as echo reference
      const renderSuccess = this.aecProcessor.processRenderAudio(matchingRender.samples);
      if (!renderSuccess) {
        logger.warn('Render audio processing failed');
      }

      // Step 2: Process capture audio (with echo removed)
      const cleanAudio = this.aecProcessor.processCaptureAudio(captureSamples);
      return cleanAudio;

    } else {
      // UNSYNCED PATH: No matching render audio found
      this.unsyncedProcessed++;

      if (this.unsyncedProcessed % 50 === 0) {
        logger.warn('AEC running without sync', {
          unsyncedCount: this.unsyncedProcessed,
          captureTimestamp,
          bufferSize: this.renderBuffer.length,
          oldestRender: this.renderBuffer[0]?.timestamp,
          newestRender: this.renderBuffer[this.renderBuffer.length - 1]?.timestamp
        });
      }

      // Fallback: Process capture anyway (AEC will work but less effectively)
      const cleanAudio = this.aecProcessor.processCaptureAudio(captureSamples);
      return cleanAudio;
    }
  }

  /**
   * Get synchronization statistics
   */
  getStats() {
    return {
      total: this.totalProcessed,
      synced: this.syncedProcessed,
      unsynced: this.unsyncedProcessed,
      syncRate: this.totalProcessed > 0
        ? (this.syncedProcessed / this.totalProcessed) * 100
        : 0,
      bufferSize: this.renderBuffer.length
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalProcessed = 0;
    this.syncedProcessed = 0;
    this.unsyncedProcessed = 0;
    logger.info('AEC sync stats reset');
  }

  /**
   * Clear the render buffer
   */
  clear(): void {
    this.renderBuffer = [];
    logger.debug('Render buffer cleared');
  }
}
