import type { ChatMessage } from '../providers/OpenAIProvider';

export const CALLOUT_SYSTEM_PROMPT = `You are an AI assistant helping someone in a meeting. When they receive a question, you provide brief, helpful context to help them answer.

Your job is to:
1. Determine if the text is a genuine question directed at the user (not rhetorical, not a statement)
2. If it is a question, provide a brief, helpful response based on the available context
3. Keep responses concise (2-3 sentences max) - this is for quick glance during a meeting

Respond in JSON format:
{
  "isQuestion": boolean,
  "suggestedResponse": "brief helpful context or answer" | null,
  "relevantInfo": ["key point 1", "key point 2"] | null
}`;

export function buildCalloutMessages(question: string, context: string): ChatMessage[] {
  return [
    { role: 'system', content: CALLOUT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Question received: "${question}"

Available context:
${context || 'No additional context available.'}

Is this a question I should respond to, and if so, what's a helpful response?`,
    },
  ];
}

export interface CalloutResponse {
  isQuestion: boolean;
  suggestedResponse: string | null;
  relevantInfo: string[] | null;
}

export function parseCalloutResponse(content: string): CalloutResponse {
  try {
    return JSON.parse(content) as CalloutResponse;
  } catch {
    return { isQuestion: false, suggestedResponse: null, relevantInfo: null };
  }
}
