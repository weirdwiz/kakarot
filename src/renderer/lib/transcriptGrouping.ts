import type { TranscriptSegment } from '@shared/types';

// Time window (ms) within which consecutive segments from same speaker are merged
const MERGE_WINDOW_MS = 45000;
const CONTINUOUS_SPEECH_MS = 2000;

export interface GroupedSegment {
  id: string;
  source: 'mic' | 'system';
  timestamp: number;
  text: string;
  segmentCount: number;
}

function endsWithSentence(text: string): boolean {
  return /[.!?]$/.test(text.trim());
}

/**
 * Group consecutive segments from the same speaker into single blocks.
 * Merges based on same speaker + time proximity or incomplete sentences.
 */
export function groupTranscriptSegments(segments: TranscriptSegment[]): GroupedSegment[] {
  if (segments.length === 0) return [];

  const groups: GroupedSegment[] = [];
  let currentGroup: GroupedSegment | null = null;

  for (const segment of segments) {
    if (!currentGroup) {
      currentGroup = {
        id: segment.id,
        source: segment.source,
        timestamp: segment.timestamp,
        text: segment.text,
        segmentCount: 1,
      };
      continue;
    }

    const timeSinceLast = segment.timestamp - currentGroup.timestamp;
    const isSameSpeaker = currentGroup.source === segment.source;
    const withinTimeWindow = timeSinceLast < MERGE_WINDOW_MS;
    const isContinuousSpeech = timeSinceLast < CONTINUOUS_SPEECH_MS;
    const previousIncomplete = !endsWithSentence(currentGroup.text);
    const shouldMerge =
      isSameSpeaker && (isContinuousSpeech || withinTimeWindow || previousIncomplete);

    if (shouldMerge) {
      currentGroup.text += ' ' + segment.text;
      currentGroup.segmentCount++;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: segment.id,
        source: segment.source,
        timestamp: segment.timestamp,
        text: segment.text,
        segmentCount: 1,
      };
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
}
