import { createLogger } from '@main/core/logger';
import type { AECProcessor } from './native/AECProcessor';

const logger = createLogger('AECSync');

interface BufferedAudio {
  samples: Float32Array;
  timestamp: number;
}

interface AECSyncOptions {
  /** Buffer size in milliseconds (default: 600) */
  bufferMs?: number;
  /** Sync tolerance in milliseconds (default: 500) */
  toleranceMs?: number;
  /** Maximum number of buffered items (default: 50) */
  maxBufferItems?: number;
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

  private readonly BUFFER_SIZE_MS: number;
  private readonly SYNC_TOLERANCE_MS: number;
  private readonly MAX_BUFFER_ITEMS: number;

  private totalProcessed = 0;
  private syncedProcessed = 0;
  private unsyncedProcessed = 0;

  constructor(aecProcessor: AECProcessor, options?: AECSyncOptions) {
    this.aecProcessor = aecProcessor;
    this.BUFFER_SIZE_MS = options?.bufferMs ?? 600;
    this.SYNC_TOLERANCE_MS = options?.toleranceMs ?? 500;
    this.MAX_BUFFER_ITEMS = options?.maxBufferItems ?? 50;

    logger.info('AECSync initialized', {
      bufferMs: this.BUFFER_SIZE_MS,
      toleranceMs: this.SYNC_TOLERANCE_MS,
      maxBufferItems: this.MAX_BUFFER_ITEMS,
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
        maxItems: this.MAX_BUFFER_ITEMS,
        bufferMs: this.BUFFER_SIZE_MS,
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

    if (!this.aecProcessor.isReady()) return null;

    // Find render audio that's slightly older than capture (mic picks up delayed echo)
    const matchingRender = this.renderBuffer.find((render) => {
      const timeDiff = captureTimestamp - render.timestamp;
      return timeDiff >= 0 && timeDiff <= this.SYNC_TOLERANCE_MS;
    });

    if (matchingRender) {
      this.syncedProcessed++;

      if (this.syncedProcessed % 100 === 0) {
        const syncRate = ((this.syncedProcessed / this.totalProcessed) * 100).toFixed(1);
        logger.debug('AEC sync stats', {
          total: this.totalProcessed,
          synced: this.syncedProcessed,
          unsynced: this.unsyncedProcessed,
          syncRate: `${syncRate}%`,
        });
      }

      this.aecProcessor.processRenderAudio(matchingRender.samples);
    } else {
      this.unsyncedProcessed++;

      if (this.unsyncedProcessed % 50 === 0) {
        const syncRate = ((this.syncedProcessed / this.totalProcessed) * 100).toFixed(1);
        logger.warn('AEC running without sync', {
          unsyncedCount: this.unsyncedProcessed,
          syncRate: `${syncRate}%`,
          bufferSize: this.renderBuffer.length,
        });
      }
    }

    return this.aecProcessor.processCaptureAudio(captureSamples);
  }

  /**
   * Get synchronization statistics
   */
  getStats() {
    return {
      total: this.totalProcessed,
      synced: this.syncedProcessed,
      unsynced: this.unsyncedProcessed,
      syncRate: this.totalProcessed > 0 ? (this.syncedProcessed / this.totalProcessed) * 100 : 0,
      bufferSize: this.renderBuffer.length,
      bufferMs: this.BUFFER_SIZE_MS,
      toleranceMs: this.SYNC_TOLERANCE_MS,
    };
  }

  clear(): void {
    this.renderBuffer = [];
  }
}
