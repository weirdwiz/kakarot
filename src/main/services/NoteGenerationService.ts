import { OpenAIProvider } from '../providers/OpenAIProvider';
import { buildNoteGenerationMessages } from '../prompts/summaryPrompts';
import { createLogger } from '../core/logger';
import type { Meeting, TranscriptSegment, AppSettings } from '@shared/types';

const logger = createLogger('NoteGenerationService');

export interface GeneratedNotes {
  title: string;
  overview: string;
  notesMarkdown: string;
}

export class NoteGenerationService {
  private aiProvider: OpenAIProvider | null = null;

  initialize(settings: AppSettings): void {
    if (settings.openAiApiKey) {
      logger.info('Initializing with settings', {
        apiKeyPrefix: settings.openAiApiKey.slice(0, 10) + '...',
        baseURL: settings.openAiBaseUrl || 'default',
        model: settings.openAiModel || 'default',
      });
      this.aiProvider = new OpenAIProvider({
        apiKey: settings.openAiApiKey,
        baseURL: settings.openAiBaseUrl || undefined,
        defaultModel: settings.openAiModel || undefined,
      });
      logger.info('Note generation service initialized');
    }
  }

  async generateNotes(meeting: Meeting): Promise<GeneratedNotes | null> {
    if (!this.aiProvider) {
      logger.warn('No AI provider configured, skipping note generation');
      return null;
    }

    if (meeting.transcript.length === 0) {
      logger.warn('Empty transcript, skipping note generation');
      return null;
    }

    const transcriptText = this.formatTranscript(meeting.transcript);
    logger.info('Generating notes', { meetingId: meeting.id, transcriptLength: transcriptText.length });

    try {
      const messages = buildNoteGenerationMessages(transcriptText);
      const response = await this.aiProvider.chat(messages, {
        maxTokens: 2000,
      });

      // Extract JSON from response (model may include markdown code blocks)
      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      const parsed = JSON.parse(jsonStr) as GeneratedNotes;
      logger.info('Notes generated', {
        meetingId: meeting.id,
        titleLength: parsed.title.length,
        notesLength: parsed.notesMarkdown.length,
      });

      return parsed;
    } catch (error) {
      logger.error('Failed to generate notes', error as Error);
      return null;
    }
  }

  private formatTranscript(segments: TranscriptSegment[]): string {
    return segments
      .filter((s) => s.isFinal)
      .map((s) => {
        const speaker = s.source === 'mic' ? 'You' : 'Other';
        return `[${speaker}]: ${s.text}`;
      })
      .join('\n');
  }
}
