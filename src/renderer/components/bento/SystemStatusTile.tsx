import React from 'react';
import { Mic, Volume2, Calendar, CheckCircle2 } from 'lucide-react';

interface SystemStatusStripProps {
  micStatus?: 'healthy' | 'warning' | 'error';
  systemAudioStatus?: 'healthy' | 'warning' | 'error';
  calendarStatus?: 'healthy' | 'warning' | 'error';
}

export default function SystemStatusStrip({
  micStatus = 'healthy',
  systemAudioStatus = 'healthy',
  calendarStatus = 'healthy',
}: SystemStatusStripProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-400';
    }
  };

  const allHealthy = micStatus === 'healthy' && systemAudioStatus === 'healthy' && calendarStatus === 'healthy';

  return (
    <div className="w-full rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-graphite/60 backdrop-blur-md shadow-soft-card px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          <span className="text-xs text-slate-700 dark:text-slate-300">Microphone</span>
          <span className={`w-2 h-2 rounded-full ${getStatusColor(micStatus)}`} />
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          <span className="text-xs text-slate-700 dark:text-slate-300">System Audio</span>
          <span className={`w-2 h-2 rounded-full ${getStatusColor(systemAudioStatus)}`} />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          <span className="text-xs text-slate-700 dark:text-slate-300">Calendar</span>
          <span className={`w-2 h-2 rounded-full ${getStatusColor(calendarStatus)}`} />
        </div>
      </div>

      {allHealthy && (
        <div className="flex items-center gap-2 text-emerald-mist">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">All systems operational</span>
        </div>
      )}
    </div>
  );
}
