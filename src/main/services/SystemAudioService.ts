import { AudioTee } from 'audiotee';
import { app } from 'electron';
import { join } from 'path';
import type { ITranscriptionProvider } from './transcription';

// Audio level callback for UI visualization
type AudioLevelCallback = (level: number) => void;

// Get the correct path to the audiotee binary
// In development: node_modules/audiotee/bin/audiotee
// In production: resources/audiotee (needs to be configured in electron-builder)
function getAudioTeeBinaryPath(): string {
  if (app.isPackaged) {
    // Production: binary should be in resources directory
    return join(process.resourcesPath, 'audiotee');
  } else {
    // Development: __dirname is dist/main, so go up 2 levels to project root
    return join(__dirname, '..', '..', 'node_modules', 'audiotee', 'bin', 'audiotee');
  }
}

export class SystemAudioService {
  private audiotee: AudioTee | null = null;
  private transcriptionProvider: ITranscriptionProvider | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private capturing: boolean = false;

  onAudioLevel(callback: AudioLevelCallback): void {
    this.audioLevelCallback = callback;
  }

  async start(transcriptionProvider: ITranscriptionProvider): Promise<void> {
    if (this.capturing) {
      console.warn('[SystemAudioService] Already capturing');
      return;
    }

    console.log('[SystemAudioService] Starting system audio capture...');
    this.transcriptionProvider = transcriptionProvider;

    const binaryPath = getAudioTeeBinaryPath();
    console.log('[SystemAudioService] AudioTee binary path:', binaryPath);

    this.audiotee = new AudioTee({
      sampleRate: 48000, // Match AssemblyAI requirement (also switches to 16-bit signed int)
      chunkDurationMs: 256, // ~12288 samples at 48kHz
      binaryPath,
    });

    let chunkCount = 0;
    this.audiotee.on('data', (chunk: { data: Buffer }) => {
      chunkCount++;
      // Log first few chunks and then every 10th
      if (chunkCount <= 3 || chunkCount % 10 === 0) {
        console.log(`[SystemAudioService] Received chunk ${chunkCount}, size: ${chunk.data.length} bytes`);
      }

      if (!this.capturing || !this.transcriptionProvider) {
        console.warn('[SystemAudioService] Dropping chunk - not capturing or no transcription provider');
        return;
      }

      // Convert Node.js Buffer to ArrayBuffer for transcription provider
      // Use Uint8Array.from to create a proper ArrayBuffer copy
      const uint8Array = new Uint8Array(chunk.data);
      const arrayBuffer = uint8Array.buffer.slice(
        uint8Array.byteOffset,
        uint8Array.byteOffset + uint8Array.byteLength
      );

      // Calculate RMS level for UI visualization (same algorithm as AudioWorklet)
      const level = this.calculateRmsLevel(chunk.data);

      if (this.audioLevelCallback) {
        this.audioLevelCallback(level);
      }

      // Send to transcription provider
      this.transcriptionProvider.sendAudio(arrayBuffer, 'system');
    });

    this.audiotee.on('start', () => {
      console.log('[SystemAudioService] AudioTee started');
      this.capturing = true;
    });

    this.audiotee.on('stop', () => {
      console.log('[SystemAudioService] AudioTee stopped');
      this.capturing = false;
    });

    this.audiotee.on('error', (error: Error) => {
      console.error('[SystemAudioService] AudioTee error:', error.message);
      // Don't throw - gracefully degrade without system audio
    });

    this.audiotee.on('log', (level: string, message: { message: string }) => {
      console.log(`[SystemAudioService] AudioTee ${level}:`, message.message);
    });

    try {
      await this.audiotee.start();
    } catch (error) {
      console.error('[SystemAudioService] Failed to start AudioTee:', error);
      // Clean up on failure
      this.audiotee = null;
      this.transcriptionProvider = null;
      // Don't rethrow - allow recording to continue without system audio
    }
  }

  async stop(): Promise<void> {
    if (!this.audiotee) {
      console.log('[SystemAudioService] Not running, nothing to stop');
      return;
    }

    console.log('[SystemAudioService] Stopping system audio capture...');
    this.capturing = false;

    try {
      await this.audiotee.stop();
    } catch (error) {
      console.error('[SystemAudioService] Error stopping AudioTee:', error);
    }

    this.audiotee = null;
    this.transcriptionProvider = null;
    this.audioLevelCallback = null;
    console.log('[SystemAudioService] Stopped');
  }

  isCapturing(): boolean {
    return this.capturing;
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
