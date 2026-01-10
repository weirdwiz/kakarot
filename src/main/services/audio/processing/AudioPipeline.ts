import { createLogger } from '@main/core/logger';
import type { IAudioProcessor, AudioProcessorConfig } from './IAudioProcessor';

const logger = createLogger('AudioPipeline');

/**
 * Sequential audio processing pipeline.
 * Automatically bypasses failed processors and continues with original audio.
 */
export class AudioPipeline {
  private processors: IAudioProcessor[] = [];
  private config: AudioProcessorConfig;
  private initialized = false;

  constructor(config: AudioProcessorConfig) {
    this.config = config;
  }

  /**
   * Add a processor to the pipeline.
   * Must be called before initialize().
   */
  addProcessor(processor: IAudioProcessor): void {
    if (this.initialized) {
      logger.warn('Adding processor after initialization', { processor: processor.name });
    }

    processor.on('bypass', (reason) => {
      logger.warn('Processor bypassed', { processor: processor.name, reason });
    });

    processor.on('error', (error) => {
      logger.error('Processor error', error, { processor: processor.name });
    });

    processor.on('metrics', (metrics) => {
      logger.debug('Processor metrics', { processor: processor.name, ...metrics });
    });

    this.processors.push(processor);
  }

  /**
   * Initialize all processors.
   * Processors that fail to initialize are marked as bypassed.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Pipeline already initialized');
      return;
    }

    logger.info('Initializing audio pipeline', {
      processors: this.processors.map((p) => p.name),
    });

    for (const processor of this.processors) {
      try {
        await processor.initialize(this.config);
        logger.info('Processor initialized', { processor: processor.name });
      } catch (error) {
        logger.error('Failed to initialize processor', error as Error, {
          processor: processor.name,
        });
        // Processor will be inactive, pipeline continues
      }
    }

    this.initialized = true;
  }

  /**
   * Process an audio chunk through all active processors.
   * If a processor returns null (bypassed), the previous chunk continues.
   */
  async process(chunk: Buffer, timestamp: number): Promise<Buffer> {
    let currentChunk = chunk;

    for (const processor of this.processors) {
      if (!processor.isActive()) {
        continue;
      }

      const result = await processor.process(currentChunk, timestamp);

      if (result !== null) {
        currentChunk = result.data;
      }
      // If null, processor is bypassed - use previous chunk
    }

    return currentChunk;
  }

  /**
   * Clean up all processors.
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up audio pipeline');

    await Promise.all(
      this.processors.map(async (p) => {
        try {
          await p.cleanup();
        } catch (error) {
          logger.error('Error cleaning up processor', error as Error, {
            processor: p.name,
          });
        }
        // Remove all event listeners to prevent memory leaks
        p.removeAllListeners();
      })
    );

    this.processors = [];
    this.initialized = false;
  }

  /**
   * Get list of currently active processors.
   */
  getActiveProcessors(): string[] {
    return this.processors.filter((p) => p.isActive()).map((p) => p.name);
  }

  /**
   * Check if any processors are active.
   */
  hasActiveProcessors(): boolean {
    return this.processors.some((p) => p.isActive());
  }
}
