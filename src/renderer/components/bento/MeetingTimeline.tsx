import React from 'react';
import { Clock, CheckCircle2, Circle } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  start: Date;
  end: Date;
  outcome?: 'completed' | 'upcoming';
  status?: string;
}

interface MeetingTimelineProps {
  meetings: Meeting[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function MeetingTimeline({ meetings, selectedId, onSelect }: MeetingTimelineProps) {
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isPast = (date: Date): boolean => {
    return new Date(date).getTime() < Date.now();
  };

  const sortedMeetings = [...meetings].sort((a, b) => 
    new Date(b.start).getTime() - new Date(a.start).getTime()
  );

  return (
    <div className="h-full rounded-2xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-graphite/80 backdrop-blur-md shadow-soft-card p-4 flex flex-col">
      <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4 px-2">
        Meeting Timeline
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {sortedMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Circle className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">No meetings yet</p>
          </div>
        ) : (
          sortedMeetings.map((meeting) => {
            const isSelected = meeting.id === selectedId;
            const meetingIsPast = isPast(meeting.end);

            return (
              <button
                key={meeting.id}
                onClick={() => onSelect(meeting.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-emerald-mist/20 dark:bg-emerald-mist/10 border border-emerald-mist/40'
                    : 'hover:bg-slate-100/50 dark:hover:bg-slate-700/30 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {meetingIsPast ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-mist mt-0.5 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      isSelected 
                        ? 'text-slate-900 dark:text-white' 
                        : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {meeting.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {formatDate(meeting.start)}
                    </p>
                    {meeting.status && (
                      <p className={`text-xs mt-1 px-2 py-0.5 rounded-md inline-block ${
                        meeting.status === 'Approved' 
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : meeting.status === 'Action Items'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                          : 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                      }`}>
                        {meeting.status}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
