import React from 'react';

interface AudioLevelMeterProps {
  label: string;
  level: number; // 0-1
}

export default function AudioLevelMeter({ label, level }: AudioLevelMeterProps) {
  const barCount = 20;
  const activeCount = Math.round(level * barCount);

  return (
    <div className="rounded-lg p-2 border bg-slate-100/50 border-white/30 dark:bg-slate-800/40 dark:border-white/10">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
      </div>
      <div className="flex gap-[2px]">
        {Array.from({ length: barCount }).map((_, i) => {
          const isActive = i < activeCount;
          const intensity = i / barCount;

          let bgColor = 'bg-slate-300/50 dark:bg-slate-700/50';
          if (isActive) {
            if (intensity < 0.5) {
              bgColor = 'bg-emerald-400/50';
            } else if (intensity < 0.8) {
              bgColor = 'bg-amber-400/50';
            } else {
              bgColor = 'bg-rose-400/50';
            }
          }

          return (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-sm transition-colors duration-75 ${bgColor}`}
            />
          );
        })}
      </div>
    </div>
  );
}
