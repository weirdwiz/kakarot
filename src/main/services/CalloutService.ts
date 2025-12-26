import { v4 as uuidv4 } from 'uuid';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { matchesQuestionPattern, CALLOUT_CONFIG } from '../config/constants';
import { buildCalloutMessages, parseCalloutResponse } from '../prompts/calloutPrompts';
import { buildSummaryMessages } from '../prompts/summaryPrompts';
import { getSpeakerLabel } from '@shared/utils/formatters';
import type { Meeting, Callout, CalloutSource, TranscriptSegment } from '@shared/types';
import type { KnowledgeService } from './KnowledgeService';

const logger = createLogger('CalloutService');

export class CalloutService {
  private recentTranscripts: TranscriptSegment[] = [];
  private knowledgeService: KnowledgeService | null = null;

  constructor(knowledgeService?: KnowledgeService) {
    this.knowledgeService = knowledgeService || null;
  }

  setKnowledgeService(service: KnowledgeService): void {
    this.knowledgeService = service;
  }

  addTranscriptContext(segment: TranscriptSegment): void {
    this.recentTranscripts.push(segment);
    if (this.recentTranscripts.length > CALLOUT_CONFIG.MAX_CONTEXT_SEGMENTS) {
      this.recentTranscripts.shift();
    }
  }

  async checkForQuestion(text: string): Promise<Callout | null> {
    if (!matchesQuestionPattern(text)) {
      return null;
    }

    const { aiProvider } = getContainer();
    if (!aiProvider) {
      logger.warn('OpenAI not configured - skipping callout generation');
      return null;
    }

    try {
      return await this.generateCallout(text);
    } catch (error) {
      logger.error('Failed to generate callout', error);
      return null;
    }
  }

  private async generateCallout(question: string): Promise<Callout | null> {
    const { aiProvider, calloutRepo, meetingRepo } = getContainer();
    if (!aiProvider) return null;

    // Gather context from multiple sources
    const conversationContext = this.getConversationContext();
    const knowledgeContext = await this.getKnowledgeContext(question);
    const pastMeetingContext = await this.getPastMeetingContext(question);

    const allContext = [conversationContext, knowledgeContext, pastMeetingContext]
      .filter(Boolean)
      .join('\n\n');

    // Call AI
    const messages = buildCalloutMessages(question, allContext);
    const response = await aiProvider.chat(messages, {
      responseFormat: 'json',
      maxTokens: 300,
    });

    const parsed = parseCalloutResponse(response);
    if (!parsed.isQuestion || !parsed.suggestedResponse) {
      return null;
    }

    // Build sources
    const sources: CalloutSource[] = [];
    if (conversationContext) {
      sources.push({
        type: 'meeting',
        title: 'Current conversation',
        excerpt: conversationContext.slice(0, 100) + '...',
      });
    }

    // Create callout
    const callout: Callout = {
      id: uuidv4(),
      meetingId: meetingRepo.getCurrentMeetingId() || '',
      triggeredAt: new Date(),
      question,
      context: allContext,
      suggestedResponse: parsed.suggestedResponse,
      sources,
      dismissed: false,
    };

    calloutRepo.save(callout);
    logger.info('Generated callout', { id: callout.id });

    return callout;
  }

  private getConversationContext(): string {
    if (this.recentTranscripts.length === 0) return '';

    return this.recentTranscripts
      .map((seg) => `${getSpeakerLabel(seg.source)}: ${seg.text}`)
      .join('\n');
  }

  private async getKnowledgeContext(query: string): Promise<string> {
    if (!this.knowledgeService) return '';

    try {
      const results = await this.knowledgeService.search(query, CALLOUT_CONFIG.MAX_KNOWLEDGE_RESULTS);
      if (results.length === 0) return '';

      return 'From your knowledge base:\n' + results.map((r) => `- ${r.content}`).join('\n');
    } catch (error) {
      logger.warn('Knowledge search failed', { error });
      return '';
    }
  }

  private async getPastMeetingContext(query: string): Promise<string> {
    const { meetingRepo } = getContainer();

    try {
      const meetings = meetingRepo.search(query);
      if (meetings.length === 0) return '';

      const excerpts: string[] = [];
      for (const meeting of meetings.slice(0, CALLOUT_CONFIG.MAX_PAST_MEETINGS)) {
        const relevantSegments = meeting.transcript
          .filter((seg) => seg.text.toLowerCase().includes(query.toLowerCase().split(' ')[0]))
          .slice(0, 2);

        if (relevantSegments.length > 0) {
          excerpts.push(
            `From "${meeting.title}":\n` + relevantSegments.map((s) => `  - ${s.text}`).join('\n')
          );
        }
      }

      return excerpts.length > 0 ? 'From past meetings:\n' + excerpts.join('\n') : '';
    } catch (error) {
      logger.warn('Past meeting search failed', { error });
      return '';
    }
  }

  async generateSummary(meeting: Meeting): Promise<string> {
    const { aiProvider } = getContainer();
    if (!aiProvider) {
      throw new Error('OpenAI not configured');
    }

    const transcript = meeting.transcript
      .map((seg) => `${getSpeakerLabel(seg.source)}: ${seg.text}`)
      .join('\n');

    const messages = buildSummaryMessages(transcript);
    const response = await aiProvider.chat(messages, { maxTokens: 1000 });

    return response || 'Unable to generate summary.';
  }

  clearContext(): void {
    this.recentTranscripts = [];
  }
}
