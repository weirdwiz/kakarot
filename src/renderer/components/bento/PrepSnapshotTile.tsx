import React from 'react';
import { BookOpen } from 'lucide-react';

export default function PrepSnapshotTile() {
  const prepItems = [
    'Review Q3 performance metrics',
    'Prepare budget proposal',
    'Clarify project timeline',
  ];

  return (
    <div className="rounded-3xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-[#0C0C0C]/80 backdrop-blur-md shadow-soft-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-[#7C3AED]" />
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Prep Snapshot</p>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Open Items</h3>
        <ul className="space-y-2">
          {prepItems.map((item, i) => (
            <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
              <span className="text-[#7C3AED] font-bold">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <button className="mt-4 px-4 py-2 bg-[#7C3AED] text-white font-medium rounded-xl transition hover:opacity-90 w-full">
        Prepare
      </button>
    </div>
  );
}
