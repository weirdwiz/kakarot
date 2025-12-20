import React from 'react';

interface AudioLevelMeterProps {
  label: string;
  level: number; // 0-1
}

export default function AudioLevelMeter({ label, level }: AudioLevelMeterProps) {
  const barCount = 20;
  const activeCount = Math.round(level * barCount);

  return (
    <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">{Math.round(level * 100)}%</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: barCount }).map((_, i) => {
          const isActive = i < activeCount;
          const intensity = i / barCount;

          let bgColor = 'bg-gray-300';
          if (isActive) {
            if (intensity < 0.5) {
              bgColor = 'bg-green-500';
            } else if (intensity < 0.8) {
              bgColor = 'bg-yellow-500';
            } else {
              bgColor = 'bg-red-500';
            }
          }

          return (
            <div
              key={i}
              className={`flex-1 h-4 rounded-sm transition-colors duration-75 ${bgColor}`}
            />
          );
        })}
      </div>
    </div>
  );
}
