import type { ChatMessage } from '../providers/OpenAIProvider';

export const NOTE_GENERATION_SYSTEM_PROMPT = `You are a meeting note generator. Analyze the transcript and generate:

1. A short, descriptive title (max 60 chars) that captures the meeting's main topic
2. An overview (1-2 sentences describing what was discussed)
3. Structured notes in markdown format with:
   - Key discussion points
   - Decisions made
   - Action items (with owners if mentioned)
   - Follow-ups

Respond in JSON format:
{
  "title": "Meeting title here",
  "overview": "Brief overview of the meeting",
  "notesMarkdown": "# Notes\\n\\n## Key Points\\n- point 1\\n- point 2\\n\\n## Decisions\\n...\\n\\n## Action Items\\n- [ ] action 1\\n..."
}`;

export function buildNoteGenerationMessages(transcript: string): ChatMessage[] {
  return [
    { role: 'system', content: NOTE_GENERATION_SYSTEM_PROMPT },
    { role: 'user', content: `Generate notes for this meeting:\n\n${transcript}` },
  ];
}

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
