import { EventEmitter } from 'events';

/**
 * Processed audio chunk with metadata
 */
export interface ProcessedAudioChunk {
  data: Buffer;
  metadata?: {
    bypassed?: boolean;
    processingTimeMs?: number;
    [key: string]: unknown;
  };
}

/**
 * Configuration for audio processors
 */
export interface AudioProcessorConfig {
  sampleRate: number;
  channels: 1 | 2;
  bitDepth: 16;
  frameSize: number; // samples per frame
}

/**
 * Base interface for audio processing components.
 * Processors operate on raw PCM audio chunks and can modify or analyze them.
 */
export interface IAudioProcessor extends EventEmitter {
  readonly name: string;

  /**
   * Initialize the processor with configuration.
   * Called once before first process() call.
   */
  initialize(config: AudioProcessorConfig): Promise<void>;

  /**
   * Process an audio chunk.
   * @param chunk Raw PCM audio data
   * @param timestamp Timestamp in milliseconds (for synchronization)
   * @returns Processed chunk or null if processor is bypassed
   */
  process(chunk: Buffer, timestamp: number): Promise<ProcessedAudioChunk | null>;

  /**
   * Clean up resources.
   * Called when audio capture stops.
   */
  cleanup(): Promise<void>;

  /**
   * Check if processor is currently active and not bypassed.
   */
  isActive(): boolean;

  // Event signatures
  on(event: 'bypass', listener: (reason: string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'metrics', listener: (metrics: Record<string, number>) => void): this;

  emit(event: 'bypass', reason: string): boolean;
  emit(event: 'error', error: Error): boolean;
  emit(event: 'metrics', metrics: Record<string, number>): boolean;
}

/**
 * Base processor with common bypass/error handling logic.
 * Extend this class for concrete processor implementations.
 */
export abstract class BaseAudioProcessor extends EventEmitter implements IAudioProcessor {
  public abstract readonly name: string;
  protected active = false;
  protected bypassed = false;
  protected config: AudioProcessorConfig | null = null;

  abstract initialize(config: AudioProcessorConfig): Promise<void>;
  abstract cleanup(): Promise<void>;
  protected abstract processInternal(chunk: Buffer, timestamp: number): Promise<Buffer>;

  async process(chunk: Buffer, timestamp: number): Promise<ProcessedAudioChunk | null> {
    if (!this.active || this.bypassed) {
      return null;
    }

    const startTime = Date.now();
    try {
      const processed = await this.processInternal(chunk, timestamp);
      return {
        data: processed,
        metadata: {
          processingTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  isActive(): boolean {
    return this.active && !this.bypassed;
  }

  protected handleError(error: Error): void {
    this.emit('error', error);
    this.bypass(`Error: ${error.message}`);
  }

  protected bypass(reason: string): void {
    if (!this.bypassed) {
      this.bypassed = true;
      this.emit('bypass', reason);
    }
  }
}
