import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { TranscriptSegment } from '../../../shared/types';
import type { ITranscriptionProvider, TranscriptCallback } from './TranscriptionProvider';

/**
 * Deepgram transcription provider implementation.
 * Uses two separate live connections for mic and system audio.
 */
export class DeepgramProvider implements ITranscriptionProvider {
  readonly name = 'Deepgram';

  private apiKey: string;
  private micConnection: LiveClient | null = null;
  private systemConnection: LiveClient | null = null;
  private transcriptCallback: TranscriptCallback | null = null;
  private startTime: number = 0;
  private micConnected: boolean = false;
  private systemConnected: boolean = false;

  constructor(apiKey: string) {
    console.log(`[${this.name}] Initializing with API key:`, apiKey ? `${apiKey.slice(0, 8)}...` : 'MISSING');
    this.apiKey = apiKey;
  }

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  async connect(): Promise<void> {
    console.log(`[${this.name}] Connecting...`);
    this.startTime = Date.now();

    const client = createClient(this.apiKey);

    const liveOptions = {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      interim_results: true,
      punctuate: true,
      encoding: 'linear16',
      sample_rate: 48000,
      channels: 1,
      diarize: false,
    };

    this.micConnection = client.listen.live(liveOptions);
    this.systemConnection = client.listen.live(liveOptions);

    // Set up handlers and wait for connections
    const micPromise = this.setupConnectionHandlers(this.micConnection, 'mic');
    const systemPromise = this.setupConnectionHandlers(this.systemConnection, 'system');

    try {
      await Promise.all([micPromise, systemPromise]);
      console.log(`[${this.name}] Connected successfully to both connections`);
    } catch (error) {
      console.error(`[${this.name}] Failed to connect:`, error);
      throw error;
    }
  }

  private setupConnectionHandlers(
    connection: LiveClient,
    source: 'mic' | 'system'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`[${this.name}] ${source} connection opened`);
        if (source === 'mic') {
          this.micConnected = true;
        } else {
          this.systemConnected = true;
        }
        resolve();
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        if (!this.transcriptCallback) return;

        const transcript = data.channel?.alternatives?.[0];
        if (!transcript?.transcript || transcript.transcript.trim() === '') return;

        const isFinal = data.is_final === true;
        if (isFinal) {
          console.log(`[${this.name}] FINAL (${source}):`, transcript.transcript.slice(0, 50));
        }

        const segment = this.createSegment(
          transcript.transcript,
          source,
          isFinal,
          transcript.words
        );
        this.transcriptCallback(segment, isFinal);
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error(`[${this.name}] Connection error (${source}):`, error);
        reject(error);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.warn(`[${this.name}] Connection closed (${source})`);
        if (source === 'mic') {
          this.micConnected = false;
        } else {
          this.systemConnected = false;
        }
      });
    });
  }

  private createSegment(
    text: string,
    source: 'mic' | 'system',
    isFinal: boolean,
    words?: Array<{ word: string; confidence: number; start: number; end: number }>
  ): TranscriptSegment {
    const mappedWords = (words || []).map((w) => ({
      text: w.word,
      confidence: w.confidence,
      isFinal,
      start: Math.round(w.start * 1000), // Convert to ms
      end: Math.round(w.end * 1000),
    }));

    return {
      id: uuidv4(),
      text,
      timestamp: Date.now() - this.startTime,
      source,
      confidence: words?.[0]?.confidence ?? 0.95,
      isFinal,
      words: mappedWords,
    };
  }

  sendAudio(audioData: ArrayBuffer, source: 'mic' | 'system'): void {
    const connection = source === 'mic' ? this.micConnection : this.systemConnection;
    const isConnected = source === 'mic' ? this.micConnected : this.systemConnected;

    if (connection && isConnected) {
      connection.send(audioData);
    }
  }

  async disconnect(): Promise<void> {
    console.log(`[${this.name}] Disconnecting...`);

    this.micConnected = false;
    this.systemConnected = false;

    if (this.micConnection) {
      this.micConnection.requestClose();
      this.micConnection = null;
    }

    if (this.systemConnection) {
      this.systemConnection.requestClose();
      this.systemConnection = null;
    }

    this.transcriptCallback = null;
    console.log(`[${this.name}] Disconnected`);
  }
}
