import type { ITranscriptionProvider } from '@main/services/transcription';
import { createLogger } from '@main/core/logger';
import { AudioBackendFactory, IAudioCaptureBackend, AudioChunk } from '@main/services/audio';
import { AUDIO_CONFIG } from '@main/config/constants';
import { AudioPipeline } from '@main/services/audio/processing';
import type { IAudioProcessor } from '@main/services/audio/processing';

const logger = createLogger('SystemAudio');

type AudioLevelCallback = (level: number) => void;

/**
 * Reference audio feeder interface for AEC.
 * Implemented by AECProcessor.
 */
export interface IReferenceAudioReceiver {
  feedReference(chunk: Buffer, timestamp: number): void;
}

export class SystemAudioService {
  private backend: IAudioCaptureBackend | null = null;
  private transcriptionProvider: ITranscriptionProvider | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private capturing: boolean = false;

  // Audio processing pipeline
  private pipeline: AudioPipeline | null = null;
  private aecProcessor: (IAudioProcessor & IReferenceAudioReceiver) | null = null;
  private startTimestamp: number = 0;

  onAudioLevel(callback: AudioLevelCallback): void {
    this.audioLevelCallback = callback;
  }

  /**
   * Set the AEC processor. Called before start() if AEC is enabled.
   */
  setAecProcessor(processor: IAudioProcessor & IReferenceAudioReceiver): void {
    this.aecProcessor = processor;
  }

  async start(transcriptionProvider: ITranscriptionProvider): Promise<void> {
    if (this.capturing) {
      logger.warn('Already capturing');
      return;
    }

    logger.info('Starting system audio capture', { platform: process.platform });
    this.transcriptionProvider = transcriptionProvider;
    this.startTimestamp = Date.now();

    // Initialize processing pipeline
    await this.initializePipeline();

    // Create platform-specific backend
    this.backend = await AudioBackendFactory.create({
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      chunkDurationMs: AUDIO_CONFIG.CHUNK_DURATION_MS,
      channels: AUDIO_CONFIG.CHANNELS,
    });

    let chunkCount = 0;
    this.backend.on('data', async (chunk: AudioChunk) => {
      chunkCount++;
      if (chunkCount <= 3 || chunkCount % 50 === 0) {
        logger.debug('Audio chunk received', { chunk: chunkCount, bytes: chunk.data.length });
      }

      if (!this.capturing || !this.transcriptionProvider) {
        return;
      }

      // Calculate timestamp relative to start
      const timestamp = Date.now() - this.startTimestamp;

      // Process through pipeline (AEC, etc.)
      let processedData = chunk.data;
      if (this.pipeline && this.pipeline.hasActiveProcessors()) {
        try {
          processedData = await this.pipeline.process(chunk.data, timestamp);
        } catch (error) {
          logger.error('Pipeline processing error', error as Error);
          // Fall back to original data
          processedData = chunk.data;
        }
      }

      // Convert Node.js Buffer to ArrayBuffer for transcription provider
      const uint8Array = new Uint8Array(processedData);
      const arrayBuffer = uint8Array.buffer.slice(
        uint8Array.byteOffset,
        uint8Array.byteOffset + uint8Array.byteLength
      );

      // Calculate RMS level for UI visualization (use processed audio)
      const level = this.calculateRmsLevel(processedData);

      if (this.audioLevelCallback) {
        this.audioLevelCallback(level);
      }

      this.transcriptionProvider.sendAudio(arrayBuffer, 'system');
    });

    this.backend.on('start', () => {
      logger.info('Audio backend started');
      this.capturing = true;
    });

    this.backend.on('stop', () => {
      logger.info('Audio backend stopped');
      this.capturing = false;
    });

    this.backend.on('error', (error: Error) => {
      logger.error('Audio backend error', error);
    });

    try {
      await this.backend.start();
    } catch (error) {
      logger.error('Failed to start audio backend', error as Error);
      await this.cleanupPipeline();
      this.backend = null;
      this.transcriptionProvider = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.backend) {
      return;
    }

    logger.info('Stopping system audio capture');
    this.capturing = false;

    try {
      await this.backend.stop();
    } catch (error) {
      logger.error('Error stopping audio backend', error as Error);
    }

    await this.cleanupPipeline();

    this.backend = null;
    this.transcriptionProvider = null;
    this.audioLevelCallback = null;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  /**
   * Feed microphone audio to the AEC processor as reference signal.
   * Called from recordingHandlers when mic audio arrives via IPC.
   */
  feedMicReference(audioData: ArrayBuffer, timestamp: number): void {
    if (this.aecProcessor) {
      const buffer = Buffer.from(audioData);
      this.aecProcessor.feedReference(buffer, timestamp);
    }
  }

  /**
   * Get the current relative timestamp (ms since start).
   */
  getTimestamp(): number {
    return Date.now() - this.startTimestamp;
  }

  private async initializePipeline(): Promise<void> {
    const frameSize = (AUDIO_CONFIG.SAMPLE_RATE * AUDIO_CONFIG.CHUNK_DURATION_MS) / 1000;

    this.pipeline = new AudioPipeline({
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      channels: AUDIO_CONFIG.CHANNELS,
      bitDepth: AUDIO_CONFIG.BIT_DEPTH,
      frameSize,
    });

    // Add AEC processor if configured
    if (this.aecProcessor) {
      this.pipeline.addProcessor(this.aecProcessor);
      logger.info('AEC processor added to pipeline');
    }

    await this.pipeline.initialize();

    logger.info('Audio pipeline initialized', {
      activeProcessors: this.pipeline.getActiveProcessors(),
    });
  }

  private async cleanupPipeline(): Promise<void> {
    if (this.pipeline) {
      await this.pipeline.cleanup();
      this.pipeline = null;
    }
    this.aecProcessor = null;
  }

  // Calculate RMS level from 16-bit signed integer PCM data
  private calculateRmsLevel(buffer: Buffer): number {
    const samples = new Int16Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / 2
    );

    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      // Normalize to -1.0 to 1.0 range
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    // Convert to 0-1 range with some scaling for better visualization
    return Math.min(1, rms * 3);
  }
}
