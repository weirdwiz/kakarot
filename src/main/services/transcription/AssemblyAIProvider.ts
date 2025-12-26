import { AssemblyAI, RealtimeTranscriber } from 'assemblyai';
import { v4 as uuidv4 } from 'uuid';
import type { TranscriptSegment } from '../../../shared/types';
import type { ITranscriptionProvider, TranscriptCallback } from './TranscriptionProvider';

/**
 * AssemblyAI transcription provider implementation.
 * Uses two separate real-time transcribers for mic and system audio.
 */
export class AssemblyAIProvider implements ITranscriptionProvider {
  readonly name = 'AssemblyAI';

  private client: AssemblyAI;
  private micTranscriber: RealtimeTranscriber | null = null;
  private systemTranscriber: RealtimeTranscriber | null = null;
  private transcriptCallback: TranscriptCallback | null = null;
  private startTime: number = 0;
  private micConnected: boolean = false;
  private systemConnected: boolean = false;

  constructor(apiKey: string) {
    console.log(`[${this.name}] Initializing with API key:`, apiKey ? `${apiKey.slice(0, 8)}...` : 'MISSING');
    this.client = new AssemblyAI({ apiKey });
  }

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  async connect(): Promise<void> {
    console.log(`[${this.name}] Connecting...`);
    this.startTime = Date.now();

    // Create two separate transcribers for mic and system audio
    this.micTranscriber = this.client.realtime.transcriber({
      sampleRate: 48000,
      encoding: 'pcm_s16le',
    });

    this.systemTranscriber = this.client.realtime.transcriber({
      sampleRate: 48000,
      encoding: 'pcm_s16le',
    });

    // Set up handlers
    this.setupTranscriberHandlers(this.micTranscriber, 'mic');
    this.setupTranscriberHandlers(this.systemTranscriber, 'system');

    // Connect both transcribers
    try {
      await Promise.all([
        this.micTranscriber.connect(),
        this.systemTranscriber.connect(),
      ]);
      console.log(`[${this.name}] Connected successfully to both transcribers`);
    } catch (error) {
      console.error(`[${this.name}] Failed to connect:`, error);
      throw error;
    }
  }

  private setupTranscriberHandlers(
    transcriber: RealtimeTranscriber,
    source: 'mic' | 'system'
  ): void {
    transcriber.on('open', () => {
      console.log(`[${this.name}] ${source} transcriber opened`);
      if (source === 'mic') {
        this.micConnected = true;
      } else {
        this.systemConnected = true;
      }
    });

    // Handle partial transcripts
    transcriber.on('transcript.partial', (transcript) => {
      if (!this.transcriptCallback) return;
      if (!transcript.text || transcript.text.trim() === '') return;

      const segment = this.createSegment(transcript.text, source, false, transcript.words);
      this.transcriptCallback(segment, false);
    });

    // Handle final transcripts
    transcriber.on('transcript.final', (transcript) => {
      if (!this.transcriptCallback) return;
      if (!transcript.text || transcript.text.trim() === '') return;

      console.log(`[${this.name}] FINAL (${source}):`, transcript.text.slice(0, 50));
      const segment = this.createSegment(transcript.text, source, true, transcript.words);
      this.transcriptCallback(segment, true);
    });

    transcriber.on('error', (error) => {
      console.error(`[${this.name}] Transcriber error (${source}):`, error);
    });

    transcriber.on('close', (code, reason) => {
      console.warn(`[${this.name}] Transcriber closed (${source}): ${code} - ${reason}`);
      if (source === 'mic') {
        this.micConnected = false;
      } else {
        this.systemConnected = false;
      }
    });
  }

  private createSegment(
    text: string,
    source: 'mic' | 'system',
    isFinal: boolean,
    words?: Array<{ text: string; confidence: number; start: number; end: number }>
  ): TranscriptSegment {
    const mappedWords = (words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      isFinal,
      start: w.start,
      end: w.end,
    }));

    return {
      id: uuidv4(),
      text,
      timestamp: Date.now() - this.startTime,
      source,
      confidence: 0.95,
      isFinal,
      words: mappedWords,
    };
  }

  sendAudio(audioData: ArrayBuffer, source: 'mic' | 'system'): void {
    const transcriber = source === 'mic' ? this.micTranscriber : this.systemTranscriber;
    const isConnected = source === 'mic' ? this.micConnected : this.systemConnected;

    if (transcriber && isConnected) {
      transcriber.sendAudio(audioData);
    }
  }

  async disconnect(): Promise<void> {
    console.log(`[${this.name}] Disconnecting...`);
    const closePromises: Promise<void>[] = [];

    this.micConnected = false;
    this.systemConnected = false;

    if (this.micTranscriber) {
      closePromises.push(this.micTranscriber.close());
      this.micTranscriber = null;
    }

    if (this.systemTranscriber) {
      closePromises.push(this.systemTranscriber.close());
      this.systemTranscriber = null;
    }

    await Promise.all(closePromises);
    this.transcriptCallback = null;
    console.log(`[${this.name}] Disconnected`);
  }
}
