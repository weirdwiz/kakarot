import React, { useEffect, useState } from 'react';
import type { CalendarEvent } from '../../../shared/types';
import { Calendar, Users, Clock, Play, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface LiveMeetingTileProps {
  event: CalendarEvent | null;
  isRecording: boolean;
  onStartNotes: () => void;
}

export default function LiveMeetingTile({
  event,
  isRecording,
  onStartNotes,
}: LiveMeetingTileProps) {
  const getMinutesUntil = (start: Date): number => {
    return Math.floor((new Date(start).getTime() - Date.now()) / 60000);
  };

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!event) {
    return (
      <div className="rounded-3xl border border-white/30 dark:border-white/10 bg-gradient-to-br from-white/80 via-slate-50/60 dark:from-[#0C0C0C]/90 dark:via-[#1A1A1A]/70 to-white/60 dark:to-[#121212]/80 backdrop-blur-md shadow-soft-card p-6 sm:p-8 col-span-1 sm:col-span-2 row-span-2 flex flex-col justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4">No upcoming meetings</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white mb-2">Ready to take notes?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Start capturing insights whenever you're ready.</p>
        </div>
        <button
          onClick={onStartNotes}
          disabled={isRecording}
          className="mt-6 px-6 py-3 bg-emerald-mist text-onyx font-semibold rounded-xl shadow-soft-card transition hover:opacity-95 disabled:opacity-60 w-fit"
        >
          + Take Notes
        </button>
      </div>
    );
  }

  const minutesUntil = getMinutesUntil(event.start);
  const isLive = minutesUntil <= 0 && minutesUntil > -60;

  return (
    <div className="rounded-3xl border border-white/30 dark:border-white/10 bg-gradient-to-br from-emerald-mist/10 via-white/70 dark:from-[#10B981]/10 dark:via-[#1A1A1A]/80 to-white/60 dark:to-[#121212]/80 backdrop-blur-md shadow-soft-card p-6 sm:p-8 col-span-1 sm:col-span-2 row-span-2 flex flex-col justify-between">
      {isLive && (
        <div className="inline-flex items-center gap-2 w-fit mb-4 px-3 py-1 rounded-full bg-emerald-mist/20 dark:bg-emerald-mist/30 border border-emerald-mist/40">
          <Zap className="w-3 h-3 text-emerald-mist animate-pulse" />
          <span className="text-xs font-semibold text-emerald-mist dark:text-emerald-mist">LIVE NOW</span>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
          {isLive ? 'Current meeting' : minutesUntil > 0 ? `In ${minutesUntil} minutes` : 'Upcoming'}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">{event.title}</h2>

        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {formatTime(event.start)} – {formatTime(event.end)}
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {event.location}
            </div>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {event.attendees.length} attendees
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onStartNotes}
        disabled={isRecording}
        className="px-6 py-3 bg-emerald-mist text-onyx font-semibold rounded-xl shadow-soft-card transition hover:opacity-95 disabled:opacity-60 w-full flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        Start Notes
      </button>
    </div>
  );
}
