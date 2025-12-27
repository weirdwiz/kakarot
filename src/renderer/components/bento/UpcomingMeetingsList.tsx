import React from 'react';
import type { CalendarEvent } from '@shared/types';
import { Calendar, Clock } from 'lucide-react';
import { formatDateShort, formatTimeShort, isToday, isTomorrow } from '@renderer/lib/formatters';

interface UpcomingMeetingsListProps {
  meetings: CalendarEvent[];
}

export default function UpcomingMeetingsList({ meetings }: UpcomingMeetingsListProps) {
  const todayMeetings = meetings.filter(m => isToday(m.start));
  const tomorrowMeetings = meetings.filter(m => isTomorrow(m.start));
  const laterMeetings = meetings.filter(m => !isToday(m.start) && !isTomorrow(m.start));

  const renderMeeting = (meeting: CalendarEvent, idx: number) => (
    <div
      key={idx}
      className="px-3 py-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/40 transition-colors"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 px-2 py-1 rounded bg-[#8B5CF6]/20 dark:bg-[#8B5CF6]/10 border border-[#8B5CF6]/30">
          <p className="text-[10px] font-bold text-[#8B5CF6] leading-tight">
            {formatDateShort(meeting.start)}
          </p>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {meeting.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {formatTimeShort(meeting.start)} – {formatTimeShort(meeting.end)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full rounded-xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-graphite/80 backdrop-blur-md shadow-soft-card p-3 flex flex-col">
      <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3 px-1">
        Upcoming Meetings
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">No upcoming meetings</p>
          </div>
        ) : (
          <>
            {/* Today */}
            <div>
              <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">TODAY</h4>
              {todayMeetings.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-500 italic px-1">No meetings today</p>
              ) : (
                <div className="space-y-2">
                  {todayMeetings.map((meeting, idx) => renderMeeting(meeting, idx))}
                </div>
              )}
            </div>

            {/* Tomorrow */}
            {tomorrowMeetings.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">TOMORROW</h4>
                <div className="space-y-2">
                  {tomorrowMeetings.map((meeting, idx) => renderMeeting(meeting, idx))}
                </div>
              </div>
            )}

            {/* Later */}
            {laterMeetings.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2 px-1">LATER</h4>
                <div className="space-y-2">
                  {laterMeetings.map((meeting, idx) => renderMeeting(meeting, idx))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
