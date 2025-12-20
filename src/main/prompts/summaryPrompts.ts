import type { ChatMessage } from '../providers/OpenAIProvider';

export const SUMMARY_SYSTEM_PROMPT = `You are a meeting summarizer. Create a concise summary that includes:
1. Main topics discussed
2. Key decisions made
3. Action items (with owners if mentioned)
4. Follow-up items

Keep the summary brief but comprehensive.`;

export function buildSummaryMessages(transcript: string): ChatMessage[] {
  return [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    { role: 'user', content: `Please summarize this meeting:\n\n${transcript}` },
  ];
}
