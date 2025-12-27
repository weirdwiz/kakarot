import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clipboard, FileText, CheckSquare } from 'lucide-react';

interface ContextPanelProps {
  selectedMeetingId?: string;
  prepItems?: string[];
  recentNotes?: string[];
  actionItems?: { text: string; completed: boolean }[];
}

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  iconColor: string;
}

function SectionHeader({ icon: Icon, title, iconColor }: SectionHeaderProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-3 px-2">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
    </div>
  );
}

interface SectionEmptyStateProps {
  message: string;
  bgClass: string;
  borderClass: string;
}

function SectionEmptyState({ message, bgClass, borderClass }: SectionEmptyStateProps): JSX.Element {
  return (
    <div className={`px-3 py-4 rounded-lg ${bgClass} border ${borderClass} text-center`}>
      <p className="text-xs text-slate-500 dark:text-slate-500 italic">{message}</p>
    </div>
  );
}

export default function ContextPanel({
  selectedMeetingId,
  prepItems = [],
  recentNotes = [],
  actionItems = [],
}: ContextPanelProps): JSX.Element {
  return (
    <div className="h-full rounded-2xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-graphite/80 backdrop-blur-md shadow-soft-card p-4 flex flex-col">
      <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4 px-2">
        Context
      </h3>

      <div className="flex-1 overflow-y-auto space-y-5 pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {/* Prep Items */}
        <div>
          <SectionHeader icon={Clipboard} title="Prep Items" iconColor="text-[#7C3AED]" />
          <div className="space-y-2">
            {prepItems.length === 0 ? (
              <SectionEmptyState
                message="No prep items yet"
                bgClass="bg-slate-100/30 dark:bg-slate-700/20"
                borderClass="border-slate-200/30 dark:border-slate-600/30"
              />
            ) : (
              prepItems.map((item, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-lg bg-slate-100/50 dark:bg-slate-700/30 border border-slate-200/50 dark:border-slate-600/50"
                >
                  <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Notes */}
        <div>
          <SectionHeader icon={FileText} title="Recent Notes" iconColor="text-emerald-mist" />
          <div className="space-y-2">
            {recentNotes.length === 0 ? (
              <SectionEmptyState
                message="No recent notes"
                bgClass="bg-emerald-mist/5 dark:bg-emerald-mist/10"
                borderClass="border-emerald-mist/10"
              />
            ) : (
              recentNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-lg bg-emerald-mist/5 dark:bg-emerald-mist/10 border border-emerald-mist/20"
                >
                  <p className="text-sm text-slate-700 dark:text-slate-300">{note}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Items */}
        <div>
          <SectionHeader icon={CheckSquare} title="Action Items" iconColor="text-amber-500" />
          <div className="space-y-2">
            {actionItems.length === 0 ? (
              <SectionEmptyState
                message="No action items"
                bgClass="bg-amber-500/5 dark:bg-amber-500/10"
                borderClass="border-amber-500/10"
              />
            ) : (
              actionItems.map((action, idx) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
