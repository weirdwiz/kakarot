import { AssemblyAI, StreamingTranscriber } from 'assemblyai';
import { v4 as uuidv4 } from 'uuid';
import type { TranscriptSegment } from '../../shared/types';

type TranscriptCallback = (segment: TranscriptSegment, isFinal: boolean) => void;

export class TranscriptionService {
  private client: AssemblyAI;
  private micTranscriber: StreamingTranscriber | null = null;
  private systemTranscriber: StreamingTranscriber | null = null;
  private transcriptCallback: TranscriptCallback | null = null;
  private startTime: number = 0;
  private micConnected: boolean = false;
  private systemConnected: boolean = false;

  constructor(apiKey: string) {
    console.log('[TranscriptionService] Initializing with API key:', apiKey ? `${apiKey.slice(0, 8)}...` : 'MISSING');
    this.client = new AssemblyAI({ apiKey });
  }

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  async connect(): Promise<void> {
    console.log('[TranscriptionService] Connecting to AssemblyAI...');
    this.startTime = Date.now();

    // Create two separate transcribers for mic and system audio
    // Using the new Universal Streaming API
    this.micTranscriber = this.client.streaming.transcriber({
      sampleRate: 16000,
      encoding: 'pcm_s16le',
      formatTurns: true,
    });

    this.systemTranscriber = this.client.streaming.transcriber({
      sampleRate: 16000,
      encoding: 'pcm_s16le',
      formatTurns: true,
    });

    // Set up mic transcriber handlers
    this.setupTranscriberHandlers(this.micTranscriber, 'mic');

    // Set up system transcriber handlers
    this.setupTranscriberHandlers(this.systemTranscriber, 'system');

    // Connect both transcribers
    try {
      await Promise.all([
        this.micTranscriber.connect(),
        this.systemTranscriber.connect(),
      ]);
      console.log('[TranscriptionService] Connected successfully to both transcribers');
    } catch (error) {
      console.error('[TranscriptionService] Failed to connect:', error);
      throw error;
    }
  }

  private setupTranscriberHandlers(
    transcriber: StreamingTranscriber,
    source: 'mic' | 'system'
  ): void {
    transcriber.on('open', (event) => {
      console.log(`[TranscriptionService] ${source} transcriber opened`);
      if (source === 'mic') {
        this.micConnected = true;
      } else {
        this.systemConnected = true;
      }
    });

    // Handle turn events - each turn contains a transcript
    transcriber.on('turn', (turn) => {
      if (!this.transcriptCallback) return;
      if (!turn.transcript || turn.transcript.trim() === '') return;

      // Skip raw finals - only accept formatted finals or partials
      // Raw finals have end_of_turn=true but turn_is_formatted=false
      if (turn.end_of_turn && !turn.turn_is_formatted) {
        console.log(`[TranscriptionService] Skipping raw final (${source})`);
        return;
      }

      console.log(`[TranscriptionService] ${turn.end_of_turn ? 'FINAL' : 'PARTIAL'} (${source}):`, turn.transcript.slice(0, 50));

      // Map words from AssemblyAI format to our format
      const words = (turn.words || []).map((w: { text: string; confidence: number; word_is_final: boolean; start: number; end: number }) => ({
        text: w.text,
        confidence: w.confidence,
        isFinal: w.word_is_final,
        start: w.start,
        end: w.end,
      }));

      const segment: TranscriptSegment = {
        id: uuidv4(),
        text: turn.transcript,
        timestamp: Date.now() - this.startTime,
        source,
        confidence: 0.95,
        isFinal: turn.end_of_turn,
        words,
      };

      this.transcriptCallback(segment, turn.end_of_turn);
    });

    transcriber.on('error', (error) => {
      console.error(`[TranscriptionService] Transcriber error (${source}):`, error);
    });

    transcriber.on('close', (code, reason) => {
      console.warn(`[TranscriptionService] Transcriber closed (${source}): ${code} - ${reason}`);
      if (source === 'mic') {
        this.micConnected = false;
      } else {
        this.systemConnected = false;
      }
    });
  }

  sendAudio(audioData: ArrayBuffer, source: 'mic' | 'system'): void {
    const transcriber =
      source === 'mic' ? this.micTranscriber : this.systemTranscriber;
    const isConnected =
      source === 'mic' ? this.micConnected : this.systemConnected;

    if (transcriber && isConnected) {
      // AssemblyAI streaming accepts ArrayBuffer directly
      transcriber.sendAudio(audioData);
    }
    // Silently drop audio if not connected - it will buffer in the worklet
  }

  async disconnect(): Promise<void> {
    console.log('[TranscriptionService] Disconnecting...');
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
    console.log('[TranscriptionService] Disconnected');
  }
}
