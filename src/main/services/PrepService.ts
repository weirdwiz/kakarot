import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { Meeting } from '@shared/types';

const logger = createLogger('PrepService');

export interface PrepParticipant {
  name: string;
  email: string | null;
  company: string | null;
  domain: string | null;
}

export interface GenerateMeetingPrepInput {
  meeting: {
    meeting_type: string; // e.g., "product sync", "sales call", "board meeting"
    objective: string; // e.g., "Discuss Q1 roadmap"
  };
  participants: PrepParticipant[];
}

export interface ParticipantPrepSection {
  name: string;
  email: string | null;
  history_strength: 'strong' | 'weak' | 'org-only' | 'none';
  context: {
    last_meeting_date: string | null;
    meeting_count: number;
    recent_topics: string[];
    key_points: string[];
  };
  talking_points: string[];
  questions_to_ask: string[];
  background: string;
}

export interface MeetingPrepOutput {
  meeting: {
    type: string;
    objective: string;
    duration_minutes: 5;
  };
  generated_at: string;
  participants: ParticipantPrepSection[];
  agenda: {
    opening: string;
    key_topics: string[];
    closing: string;
  };
  success_metrics: string[];
  risk_mitigation: string[];
}

export class PrepService {
  async generateMeetingPrep(input: GenerateMeetingPrepInput): Promise<MeetingPrepOutput> {
    logger.info('Generating meeting prep', {
      meetingType: input.meeting.meeting_type,
      participantCount: input.participants.length,
    });

    const { aiProvider, meetingRepo } = getContainer();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }
    if (!meetingRepo) {
      throw new Error('Meeting repository not available');
    }

    // Retrieve participant histories
    const participantContexts = await this.retrieveParticipantContexts(input.participants);

    // Prepare agent prompt with context
    const agentPrompt = this.buildAgentPrompt(input, participantContexts);

    // Call OpenAI with structured output
    const prepContent = await aiProvider.chat(
      [{ role: 'user', content: agentPrompt }],
      {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2000,
        responseFormat: 'json',
      }
    );

    // Parse and validate response
    let prepData: MeetingPrepOutput;
    try {
      prepData = JSON.parse(prepContent);
    } catch (error) {
      logger.error('Failed to parse prep output', { error });
      throw new Error('Invalid AI response format');
    }

    // Ensure response matches output contract
    return this.validateAndFormatOutput(prepData, input);
  }

  private async retrieveParticipantContexts(
    participants: PrepParticipant[]
  ): Promise<Record<string, ParticipantContext>> {
    const { meetingRepo } = getContainer();
    if (!meetingRepo) {
      throw new Error('Meeting repository not available');
    }

    const contexts: Record<string, ParticipantContext> = {};

    for (const participant of participants) {
      const meetings = meetingRepo.findAll();

      // Filter meetings by email or domain
      let filtered = this.filterMeetingsByParticipant(meetings, participant);

      // Sort by most recent
      filtered = filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Keep only recent meetings (last 5)
      const recentMeetings = filtered.slice(0, 5);

      // Determine history strength
      const strength = this.determineHistoryStrength(participant, recentMeetings);

      // Extract context
      contexts[participant.email || participant.name] = {
        participant,
        meetings: recentMeetings,
        strength,
        recentTopics: this.extractTopics(recentMeetings),
        keyPoints: this.extractKeyPoints(recentMeetings),
      };
    }

    return contexts;
  }

  private filterMeetingsByParticipant(meetings: Meeting[], participant: PrepParticipant): Meeting[] {
    return meetings.filter((meeting) => {
      // Rule 1: Filter by exact email
      if (participant.email) {
        if (meeting.attendeeEmails?.includes(participant.email)) {
          return true;
        }
      }

      // Rule 2: Filter by domain if email is null but domain exists
      if (!participant.email && participant.domain) {
        const domainMatch = meeting.attendeeEmails?.some((email) =>
          email.endsWith(`@${participant.domain}`)
        );
        if (domainMatch) {
          return true;
        }
      }

      // Rule 3: Treat as cold meeting if no email or domain
      return false;
    });
  }

  private determineHistoryStrength(
    participant: PrepParticipant,
    meetings: Meeting[]
  ): 'strong' | 'weak' | 'org-only' | 'none' {
    if (meetings.length === 0) {
      return 'none';
    }

    // strong: Email match with 3+ meetings or very recent (within 2 weeks)
    if (participant.email) {
      if (meetings.length >= 3) {
        return 'strong';
      }
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      if (meetings[0] && new Date(meetings[0].createdAt).getTime() > twoWeeksAgo) {
        return 'strong';
      }
    }

    // weak: Email match with 1-2 meetings
    if (participant.email && meetings.length <= 2) {
      return 'weak';
    }

    // org-only: Domain match
    if (!participant.email && participant.domain) {
      return 'org-only';
    }

    return 'none';
  }

  private extractTopics(meetings: Meeting[]): string[] {
    const topics = new Set<string>();

    meetings.forEach((meeting) => {
      // Extract from title
      if (meeting.title) {
        topics.add(meeting.title);
      }

      // Extract from summary
      if (meeting.summary) {
        // Simple heuristic: split by period and take first sentence
        const sentences = meeting.summary.split('.').filter((s) => s.trim());
        if (sentences.length > 0) {
          topics.add(sentences[0].trim());
        }
      }
    });

    return Array.from(topics).slice(0, 5);
  }

  private extractKeyPoints(meetings: Meeting[]): string[] {
    const keyPoints = new Set<string>();

    meetings.forEach((meeting) => {
      // Extract from action items
      if (meeting.actionItems && meeting.actionItems.length > 0) {
        meeting.actionItems.slice(0, 2).forEach((item) => {
          keyPoints.add(item);
        });
      }

      // Extract from transcript (participant mentions from system audio)
      if (meeting.transcript && meeting.transcript.length > 0) {
        const systemSegments = meeting.transcript.filter((s) => s.source === 'system');
        if (systemSegments.length > 0) {
          // Take first meaningful segment from other participants
          const meaningful = systemSegments.find((s) => s.text.length > 20);
          if (meaningful) {
            keyPoints.add(meaningful.text.substring(0, 100));
          }
        }
      }
    });

    return Array.from(keyPoints).slice(0, 5);
  }

  private buildAgentPrompt(
    input: GenerateMeetingPrepInput,
    contexts: Record<string, ParticipantContext>
  ): string {
    const contextStrings = Object.entries(contexts)
      .map(([_key, context]) => {
        const { participant, strength, recentTopics, keyPoints } = context;
        return `
**${participant.name} (${participant.email || 'no-email'}) [${strength}]**
- Organization: ${participant.company || 'Unknown'}
- Domain: ${participant.domain || 'N/A'}
- Recent Topics: ${recentTopics.join(', ') || 'None'}
- Key Points: ${keyPoints.join(', ') || 'None'}
`;
      })
      .join('\n');

    return `You are an expert meeting preparation agent. Generate a deterministic 5-minute meeting briefing in strict JSON format.

MEETING DETAILS:
- Type: ${input.meeting.meeting_type}
- Objective: ${input.meeting.objective}
- Participants: ${input.participants.map((p) => p.name).join(', ')}

PARTICIPANT CONTEXT:
${contextStrings}

INSTRUCTIONS:
1. Return VALID JSON only - no markdown, no extra text
2. For each participant, generate 2-3 talking points and 1-2 questions based on their history
3. Use "none" for relationships with no history
4. Generate 3-4 key agenda topics
5. Include 2-3 success metrics
6. Include 2-3 risk mitigation strategies
7. Keep all fields concise (15-25 words per field)
8. Duration is always exactly 5 minutes

RESPONSE FORMAT:
{
  "meeting": {
    "type": "string",
    "objective": "string",
    "duration_minutes": 5
  },
  "generated_at": "ISO8601 timestamp",
  "participants": [
    {
      "name": "string",
      "email": "string or null",
      "history_strength": "strong|weak|org-only|none",
      "context": {
        "last_meeting_date": "ISO8601 or null",
        "meeting_count": number,
        "recent_topics": ["string"],
        "key_points": ["string"]
      },
      "talking_points": ["string"],
      "questions_to_ask": ["string"],
      "background": "string (1-2 sentences)"
    }
  ],
  "agenda": {
    "opening": "string (1-2 sentences)",
    "key_topics": ["string"],
    "closing": "string (1-2 sentences)"
  },
  "success_metrics": ["string"],
  "risk_mitigation": ["string"]
}`;
  }

  private validateAndFormatOutput(
    prepData: any,
    input: GenerateMeetingPrepInput
  ): MeetingPrepOutput {
    // Ensure top-level structure
    if (!prepData.meeting || !prepData.participants || !prepData.agenda) {
      throw new Error('Invalid prep output structure');
    }

    // Ensure meeting object
    const meeting = {
      type: prepData.meeting.type || input.meeting.meeting_type,
      objective: prepData.meeting.objective || input.meeting.objective,
      duration_minutes: 5 as const,
    };

    // Ensure participants array
    const participants: ParticipantPrepSection[] = (prepData.participants || []).map(
      (p: any, index: number) => ({
        name: p.name || input.participants[index]?.name || 'Unknown',
        email: p.email || null,
        history_strength: (['strong', 'weak', 'org-only', 'none'].includes(p.history_strength)
          ? p.history_strength
          : 'none') as 'strong' | 'weak' | 'org-only' | 'none',
        context: {
          last_meeting_date: p.context?.last_meeting_date || null,
          meeting_count: p.context?.meeting_count || 0,
          recent_topics: Array.isArray(p.context?.recent_topics) ? p.context.recent_topics : [],
          key_points: Array.isArray(p.context?.key_points) ? p.context.key_points : [],
        },
        talking_points: Array.isArray(p.talking_points) ? p.talking_points : [],
        questions_to_ask: Array.isArray(p.questions_to_ask) ? p.questions_to_ask : [],
        background: p.background || '',
      })
    );

    // Ensure agenda
    const agenda = {
      opening: prepData.agenda?.opening || `Prepare to discuss ${input.meeting.objective}.`,
      key_topics: Array.isArray(prepData.agenda?.key_topics) ? prepData.agenda.key_topics : [],
      closing: prepData.agenda?.closing || 'Confirm next steps and follow-up items.',
    };

    // Ensure metrics and mitigations
    const success_metrics = Array.isArray(prepData.success_metrics) ? prepData.success_metrics : [];
    const risk_mitigation = Array.isArray(prepData.risk_mitigation)
      ? prepData.risk_mitigation
      : [];

    return {
      meeting,
      generated_at: new Date().toISOString(),
      participants,
      agenda,
      success_metrics,
      risk_mitigation,
    };
  }
}

interface ParticipantContext {
  participant: PrepParticipant;
  meetings: Meeting[];
  strength: 'strong' | 'weak' | 'org-only' | 'none';
  recentTopics: string[];
  keyPoints: string[];
}
