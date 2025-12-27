import { EventEmitter } from 'events';

export interface AudioChunk {
  data: Buffer;
}

export interface AudioCaptureConfig {
  sampleRate: number;
  chunkDurationMs: number;
  channels?: 1 | 2;
}

export interface IAudioCaptureBackend extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  isCapturing(): boolean;

  on(event: 'data', listener: (chunk: AudioChunk) => void): this;
  on(event: 'start', listener: () => void): this;
  on(event: 'stop', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'data', chunk: AudioChunk): boolean;
  emit(event: 'start'): boolean;
  emit(event: 'stop'): boolean;
  emit(event: 'error', error: Error): boolean;
}

export abstract class BaseAudioBackend extends EventEmitter implements IAudioCaptureBackend {
  protected capturing = false;
  protected config: AudioCaptureConfig;

  constructor(config: AudioCaptureConfig) {
    super();
    this.config = config;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  isCapturing(): boolean {
    return this.capturing;
  }
}
