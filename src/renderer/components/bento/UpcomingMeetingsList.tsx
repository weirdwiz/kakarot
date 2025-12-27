import React from 'react';
import type { CalendarEvent } from '../../../shared/types';
import { Calendar, Clock, Settings } from 'lucide-react';

interface UpcomingMeetingsListProps {
  meetings: CalendarEvent[];
  onNavigateSettings?: () => void;
  onSelectMeeting?: (meeting: CalendarEvent) => void;
}

export default function UpcomingMeetingsList({ meetings, onNavigateSettings, onSelectMeeting }: UpcomingMeetingsListProps) {
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    const d = new Date(date);
    return d.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date): boolean => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = new Date(date);
    return d.toDateString() === tomorrow.toDateString();
  };

  const todayMeetings = meetings.filter(m => isToday(m.start));
  const tomorrowMeetings = meetings.filter(m => isTomorrow(m.start));
  const laterMeetings = meetings.filter(m => !isToday(m.start) && !isTomorrow(m.start));

  const renderMeeting = (meeting: CalendarEvent): JSX.Element => (
    <button
      key={meeting.id}
      onClick={() => onSelectMeeting?.(meeting)}
      className="w-full text-left px-3 py-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 px-2 py-1 rounded bg-[#8B5CF6]/20 dark:bg-[#8B5CF6]/10 border border-[#8B5CF6]/30">
          <p className="text-[10px] font-bold text-[#8B5CF6] leading-tight">
            {formatDate(meeting.start)}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {meeting.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {formatTime(meeting.start)} – {formatTime(meeting.end)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );

  const MeetingSection = (props: {
    label: string;
    meetings: CalendarEvent[];
    emptyMessage?: string;
    renderMeeting: (meeting: CalendarEvent) => JSX.Element;
  }): JSX.Element => (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500 mb-2 px-1">
        {props.label}
      </h4>
      <div className="space-y-2">
        {props.meetings.length > 0 ? (
          props.meetings.map(meeting => props.renderMeeting(meeting))
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-500 px-1">{props.emptyMessage}</p>
        )}
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
          <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
            <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-3 opacity-50" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">No calendar connected</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">Connect your calendar to see upcoming meetings</p>
            {onNavigateSettings && (
              <button
                onClick={onNavigateSettings}
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3 h-3" />
                Connect Calendar
              </button>
            )}
          </div>
        ) : (
          <>
            <MeetingSection
              label="TODAY"
              meetings={todayMeetings}
              emptyMessage="No meetings today"
              renderMeeting={renderMeeting}
            />

            {tomorrowMeetings.length > 0 && (
              <MeetingSection
                label="TOMORROW"
                meetings={tomorrowMeetings}
                renderMeeting={renderMeeting}
              />
            )}

            {laterMeetings.length > 0 && (
              <MeetingSection
                label="LATER"
                meetings={laterMeetings}
                renderMeeting={renderMeeting}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
