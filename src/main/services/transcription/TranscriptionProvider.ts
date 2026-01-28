import type { TranscriptSegment } from '@shared/types';

export type TranscriptCallback = (segment: TranscriptSegment, isFinal: boolean) => void;

/**
 * Interface for transcription service providers.
 * Supports dual audio streams (mic + system) with separate transcribers.
 */
export interface ITranscriptionProvider {
  /** Register callback for transcript events */
  onTranscript(callback: TranscriptCallback): void;

  /** Connect to the transcription service */
  connect(): Promise<void>;

  /** Send audio data to the appropriate transcriber */
  sendAudio(audioData: ArrayBuffer, source: 'mic' | 'system'): void;

  /** Disconnect from the transcription service */
  disconnect(): Promise<void>;

  /** Provider name for logging */
  readonly name: string;
}
