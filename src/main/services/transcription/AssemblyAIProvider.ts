import { AssemblyAI } from 'assemblyai';
import type { StreamingTranscriber } from 'assemblyai';
import { v4 as uuidv4 } from 'uuid';
import type { TranscriptSegment } from '@shared/types';
import type { ITranscriptionProvider, TranscriptCallback } from './TranscriptionProvider';
import { createLogger } from '../../core/logger';

const logger = createLogger('AssemblyAI');

export class AssemblyAIProvider implements ITranscriptionProvider {
  readonly name = 'AssemblyAI';

  private client: AssemblyAI;
  private micTranscriber: StreamingTranscriber | null = null;
  private systemTranscriber: StreamingTranscriber | null = null;
  private transcriptCallback: TranscriptCallback | null = null;
  private startTime: number = 0;
  private micConnected: boolean = false;
  private systemConnected: boolean = false;

  constructor(apiKey: string) {
    logger.debug('Initializing', { keyPresent: !!apiKey });
    this.client = new AssemblyAI({ apiKey });
  }

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  async connect(): Promise<void> {
    logger.info('Connecting');
    this.startTime = Date.now();

    // Match audio capture sample rate
    this.micTranscriber = this.client.streaming.transcriber({
      sampleRate: 48000,
    });

    this.systemTranscriber = this.client.streaming.transcriber({
      sampleRate: 48000,
    });

    this.setupTranscriberHandlers(this.micTranscriber, 'mic');
    this.setupTranscriberHandlers(this.systemTranscriber, 'system');

    try {
      await Promise.all([
        this.micTranscriber.connect(),
        this.systemTranscriber.connect(),
      ]);
      logger.info('Connected to both transcribers');
    } catch (error) {
      logger.error('Failed to connect', error as Error);
      throw error;
    }
  }

  private setupTranscriberHandlers(
    transcriber: StreamingTranscriber,
    source: 'mic' | 'system'
  ): void {
    transcriber.on('open', () => {
      logger.debug('Transcriber opened', { source });
      if (source === 'mic') {
        this.micConnected = true;
      } else {
        this.systemConnected = true;
      }
    });

    transcriber.on('turn', (turn) => {
      if (!this.transcriptCallback) return;
      if (!turn.transcript || turn.transcript.trim() === '') return;

      const isFinal = turn.end_of_turn;
      if (isFinal) {
        logger.debug('Final transcript', { source, text: turn.transcript.slice(0, 30) });
      }

      const segment = this.createSegment(turn.transcript, source, isFinal, turn.words);
      this.transcriptCallback(segment, isFinal);
    });

    transcriber.on('error', (error) => {
      logger.error('Transcriber error', error, { source });
    });

    transcriber.on('close', (code, reason) => {
      logger.warn('Transcriber closed', { source, code, reason });
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
    words?: Array<{ text: string; confidence: number; start: number; end: number; word_is_final: boolean }>
  ): TranscriptSegment {
    const mappedWords = (words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      isFinal: w.word_is_final,
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
    logger.info('Disconnecting');
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
    logger.info('Disconnected');
  }
}
