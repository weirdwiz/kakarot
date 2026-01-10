import { AssemblyAI } from 'assemblyai';
import type { StreamingTranscriber } from 'assemblyai';
import { BaseDualStreamProvider } from './BaseDualStreamProvider';
import { createLogger } from '../../core/logger';

const logger = createLogger('AssemblyAI');

export class AssemblyAIProvider extends BaseDualStreamProvider {
  readonly name = 'AssemblyAI';

  private client: AssemblyAI;
  private micTranscriber: StreamingTranscriber | null = null;
  private systemTranscriber: StreamingTranscriber | null = null;

  constructor(apiKey: string) {
    super();
    logger.debug('Initializing', { keyPresent: !!apiKey });
    this.client = new AssemblyAI({ apiKey });
  }

  async connect(): Promise<void> {
    logger.info('Connecting');
    this.startTime = Date.now();

    this.micTranscriber = this.client.streaming.transcriber({
      sampleRate: 48000,
      formatTurns: true,
    });

    this.systemTranscriber = this.client.streaming.transcriber({
      sampleRate: 48000,
      formatTurns: true,
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
      this.setConnectionState(source, true);
    });

    transcriber.on('turn', (turn) => {
      if (!this.transcriptCallback) return;
      if (!turn.transcript || turn.transcript.trim() === '') return;

      const turnData = turn as typeof turn & { turn_is_formatted?: boolean };
      if (turn.end_of_turn && turnData.turn_is_formatted === false) return;

      const isFinal = turn.end_of_turn && turnData.turn_is_formatted === true;
      const segmentId = `${source}-${turn.turn_order}`;

      if (isFinal) {
        logger.debug('Final transcript', { source, text: turn.transcript.slice(0, 30) });
      }

      const segment = this.createSegment(segmentId, turn.transcript, source, isFinal, turn.words);
      this.transcriptCallback(segment, isFinal);
    });

    transcriber.on('error', (error) => {
      logger.error('Transcriber error', error, { source });
    });

    transcriber.on('close', (code, reason) => {
      logger.warn('Transcriber closed', { source, code, reason });
      this.setConnectionState(source, false);
    });
  }

  private createSegment(
    id: string,
    text: string,
    source: 'mic' | 'system',
    isFinal: boolean,
    words?: Array<{ text: string; confidence: number; start: number; end: number; word_is_final: boolean }>
  ) {
    const mappedWords = (words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      isFinal: w.word_is_final,
      start: w.start,
      end: w.end,
    }));

    return this.createBaseSegment(id, text, source, isFinal, 0.95, mappedWords);
  }

  protected sendToMic(audioData: ArrayBuffer): void {
    this.micTranscriber?.sendAudio(audioData);
  }

  protected sendToSystem(audioData: ArrayBuffer): void {
    this.systemTranscriber?.sendAudio(audioData);
  }

  async disconnect(): Promise<void> {
    logger.info('Disconnecting');
    const closePromises: Promise<void>[] = [];

    if (this.micTranscriber) {
      closePromises.push(this.micTranscriber.close());
      this.micTranscriber = null;
    }

    if (this.systemTranscriber) {
      closePromises.push(this.systemTranscriber.close());
      this.systemTranscriber = null;
    }

    await Promise.all(closePromises);
    this.resetState();
    logger.info('Disconnected');
  }
}
