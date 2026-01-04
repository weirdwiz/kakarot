import React from 'react';
import type { CalendarEvent } from '../../../shared/types';
import { Calendar, FileText, Clipboard, Trash2 } from 'lucide-react';

interface CompactMeetingBarProps {
  events: CalendarEvent[];
  isRecording: boolean;
  onStartNotes: (event?: CalendarEvent) => void;
  onPrep?: () => void;
  onDismiss?: (eventId: string) => void;
}

export default function CompactMeetingBar({
  events,
  isRecording,
  onStartNotes,
  onPrep,
  onDismiss,
}: CompactMeetingBarProps) {
  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMinutesUntil = (start: Date): number => {
    return Math.floor((new Date(start).getTime() - Date.now()) / 60000);
  };

  const getPlatformIcon = (location?: string) => {
    if (!location) return null;
    const lower = location.toLowerCase();
    if (lower.includes('zoom')) return 'Zoom';
    if (lower.includes('meet') || lower.includes('google')) return 'Meet';
    if (lower.includes('teams')) return 'Teams';
    return null;
  };

  if (!events || events.length === 0) {
    return (
      <div className="w-full rounded-xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-graphite/80 backdrop-blur-md shadow-soft-card px-4 py-2 flex items-center justify-start">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">No Meeting Going on, enjoy some wind down time :)</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">We’ll surface your meeting here when it’s live.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {events.map((event) => {
        const minutesUntil = getMinutesUntil(event.start);
        const isLive = minutesUntil <= 0 && new Date(event.end).getTime() - Date.now() > 0;
        const platform = getPlatformIcon(event.location);

        return (
          <div key={event.id} className="rounded-xl border border-white/30 dark:border-white/10 bg-gradient-to-r from-emerald-mist/10 via-white/70 dark:from-[#10B981]/10 dark:via-[#1A1A1A]/80 to-white/60 dark:to-[#121212]/80 backdrop-blur-md shadow-soft-card px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {isLive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 dark:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                  <span className="text-[10px] font-semibold text-[#8B5CF6] uppercase">Live</span>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{event.title}</h3>
                  {platform && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                      {platform}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {formatTime(event.start)} – {formatTime(event.end)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {onDismiss && (
                <button
                  onClick={() => {
                    console.log('[CompactMeetingBar] Trash icon clicked for event:', event.id);
                    onDismiss(event.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Remove from live bar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onStartNotes(event)}
                disabled={isRecording}
                className="px-3 py-1.5 bg-emerald-mist text-onyx text-sm font-semibold rounded-lg shadow-soft-card transition hover:opacity-95 disabled:opacity-60 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Start Notes
              </button>
              {onPrep && (
                <button
                  onClick={onPrep}
                  className="px-3 py-1.5 bg-white/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg border border-slate-300/50 dark:border-slate-600/50 transition hover:bg-slate-100 dark:hover:bg-slate-600/80 flex items-center gap-1.5"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  Prep
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
