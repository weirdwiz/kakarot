import React, { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@shared/types';
import { MicOff } from 'lucide-react';
import { formatTimestamp, getSpeakerLabel } from '../lib/formatters';

interface LiveTranscriptProps {
  segments: TranscriptSegment[];
  currentPartials: {
    mic: TranscriptSegment | null;
    system: TranscriptSegment | null;
  };
}

export default function LiveTranscript({ segments, currentPartials }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when segments or partials change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments, currentPartials]);

  const hasPartials = currentPartials.mic || currentPartials.system;

  if (segments.length === 0 && !hasPartials) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MicOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Start recording to see live transcription</p>
        </div>
      </div>
    );
  }

  // Collect active partials to render after finals
  const activePartials = [currentPartials.system, currentPartials.mic].filter(
    (p): p is TranscriptSegment => p !== null
  );

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto pr-2 space-y-4"
    >
      {/* Final segments (black text) - each segment is its own bubble */}
      {segments.map((segment) => (
        <div
          key={segment.id}
          className={`transcript-segment flex ${
            segment.source === 'mic' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              segment.source === 'mic'
                ? 'bg-gray-900 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-900 rounded-bl-md border border-gray-200'
            }`}
          >
            <div className="text-xs opacity-70 mb-1">
              {getSpeakerLabel(segment.source)} -{' '}
              {formatTimestamp(segment.timestamp)}
            </div>
            <p className="text-sm leading-relaxed">{segment.text}</p>
          </div>
        </div>
      ))}

      {/* Partial segments - word-level styling (final=solid, non-final=gray) */}
      {activePartials.map((partial) => (
        <div
          key={`partial-${partial.source}`}
          className={`transcript-segment flex ${
            partial.source === 'mic' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              partial.source === 'mic'
                ? 'bg-gray-900 rounded-br-md'
                : 'bg-gray-100 rounded-bl-md border border-gray-200'
            }`}
          >
            <div className={`text-xs opacity-70 mb-1 ${partial.source === 'mic' ? 'text-gray-400' : 'text-gray-500'}`}>
              {getSpeakerLabel(partial.source)} -{' '}
              {formatTimestamp(partial.timestamp)}
            </div>
            <p className="text-sm leading-relaxed">
              {partial.words.map((word, i) => (
                <span
                  key={i}
                  className={
                    word.isFinal
                      ? partial.source === 'mic' ? 'text-white' : 'text-gray-900'
                      : partial.source === 'mic' ? 'text-gray-500' : 'text-gray-400'
                  }
                >
                  {word.text}{' '}
                </span>
              ))}
              <span className={`inline-block w-2 h-4 ml-1 opacity-50 animate-pulse ${partial.source === 'mic' ? 'bg-gray-400' : 'bg-gray-500'}`} />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
