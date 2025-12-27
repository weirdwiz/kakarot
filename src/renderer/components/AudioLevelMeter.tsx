import React from 'react';

interface AudioLevelMeterProps {
  label: string;
  level: number; // 0-1
}

export default function AudioLevelMeter({ label, level }: AudioLevelMeterProps) {
  const width = Math.max(0, Math.min(1, level)) * 100;

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
      <div className="w-24 h-2 rounded-full bg-slate-200/60 dark:bg-slate-700/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-slate-500/60 dark:bg-slate-300/40 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
