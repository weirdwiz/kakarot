import React from 'react';
import { Calendar, FileText, Plus } from 'lucide-react';
import { formatDateShort, formatTimeShort } from '@renderer/lib/formatters';

interface Meeting {
  id: string;
  title: string;
  start: Date;
  end: Date;
  hasTranscript?: boolean;
}

interface PreviousMeetingsListProps {
  meetings: Meeting[];
  onViewNotes?: (id: string) => void;
}

export default function PreviousMeetingsList({ meetings, onViewNotes }: PreviousMeetingsListProps) {
  return (
    <div className="h-full rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-graphite/70 backdrop-blur-md shadow-soft-card p-3 flex flex-col opacity-90">
      <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3 px-1">
        Previous Meetings
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2 opacity-50" />
            <p className="text-sm text-slate-500 dark:text-slate-500">No previous meetings</p>
          </div>
        ) : (
          meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-slate-800/20 border border-slate-200/40 dark:border-slate-700/40"
            >
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 px-2 py-1 rounded bg-slate-200/40 dark:bg-slate-700/30 border border-slate-300/30 dark:border-slate-600/30">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                    {formatDateShort(meeting.start)}
                  </p>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-400 truncate">
                    {meeting.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    {formatTimeShort(meeting.start)} – {formatTimeShort(meeting.end)}
                  </p>
                  
                  <div className="mt-2">
                    {meeting.hasTranscript ? (
                      <button
                        onClick={() => onViewNotes?.(meeting.id)}
                        className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] dark:hover:text-[#A78BFA] font-medium flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        View Notes
                      </button>
                    ) : (
                      <button
                        onClick={() => onViewNotes?.(meeting.id)}
                        className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] dark:hover:text-[#A78BFA] font-medium flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add notes
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
