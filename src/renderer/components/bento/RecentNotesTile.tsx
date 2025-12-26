import React from 'react';
import { FileText, ChevronRight } from 'lucide-react';

export default function RecentNotesTile() {
  const recentMeetings = [
    { title: 'Team Sync', date: 'Dec 24', outcome: 'Action Items' },
    { title: 'Client Review', date: 'Dec 22', outcome: 'Approved' },
    { title: 'Planning Session', date: 'Dec 20', outcome: 'In Progress' },
  ];

  const outcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'Approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'Action Items':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    }
  };

  return (
    <div className="rounded-3xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-[#0C0C0C]/80 backdrop-blur-md shadow-soft-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-emerald-mist" />
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recent Notes</p>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Last 3 Meetings</h3>
        <ul className="space-y-2">
          {recentMeetings.map((meeting, i) => (
            <li key={i} className="text-sm flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{meeting.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{meeting.date}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${outcomeColor(meeting.outcome)}`}>
                {meeting.outcome}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-medium rounded-xl transition hover:bg-slate-200 dark:hover:bg-slate-700 w-full flex items-center justify-center gap-2">
        View All
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
