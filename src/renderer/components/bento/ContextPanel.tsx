import React from 'react';
import { Clipboard, FileText, CheckSquare } from 'lucide-react';

interface ContextPanelProps {
  selectedMeetingId?: string;
  prepItems?: string[];
  recentNotes?: string[];
  actionItems?: { text: string; completed: boolean }[];
}

export default function ContextPanel({
  selectedMeetingId,
  prepItems = [],
  recentNotes = [],
  actionItems = [],
}: ContextPanelProps) {
  // Default placeholder data
  const defaultPrep = [
    'Review previous meeting notes',
    'Check action items from last sync',
    'Prepare questions for discussion',
  ];

  const defaultNotes = [
    'Discussed Q1 roadmap priorities',
    'Agreed on sprint timeline',
    'Follow-up needed on deployment',
  ];

  const defaultActions = [
    { text: 'Update project timeline', completed: false },
    { text: 'Schedule follow-up meeting', completed: true },
    { text: 'Review design mockups', completed: false },
  ];

  const displayPrep = prepItems.length > 0 ? prepItems : defaultPrep;
  const displayNotes = recentNotes.length > 0 ? recentNotes : defaultNotes;
  const displayActions = actionItems.length > 0 ? actionItems : defaultActions;

  return (
    <div className="h-full rounded-2xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-graphite/80 backdrop-blur-md shadow-soft-card p-4 flex flex-col">
      <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4 px-2">
        Context
      </h3>

      <div className="flex-1 overflow-y-auto space-y-5 pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {/* Prep Items */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <Clipboard className="w-4 h-4 text-[#7C3AED]" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Prep Items</h4>
          </div>
          <div className="space-y-2">
            {displayPrep.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-2 rounded-lg bg-slate-100/50 dark:bg-slate-700/30 border border-slate-200/50 dark:border-slate-600/50"
              >
                <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Notes */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <FileText className="w-4 h-4 text-emerald-mist" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Notes</h4>
          </div>
          <div className="space-y-2">
            {displayNotes.map((note, idx) => (
              <div
                key={idx}
                className="px-3 py-2 rounded-lg bg-emerald-mist/5 dark:bg-emerald-mist/10 border border-emerald-mist/20"
              >
                <p className="text-sm text-slate-700 dark:text-slate-300">{note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-2">
            <CheckSquare className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Action Items</h4>
          </div>
          <div className="space-y-2">
            {displayActions.map((action, idx) => (
              <div
                key={idx}
                className="px-3 py-2 rounded-lg bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 flex items-start gap-2"
              >
                <input
                  type="checkbox"
                  checked={action.completed}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-mist focus:ring-emerald-mist/50"
                />
                <p
                  className={`text-sm flex-1 ${
                    action.completed
                      ? 'line-through text-slate-500 dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {action.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
