import React, { useEffect, useState } from 'react';
import type { CalendarEvent } from '@shared/types';
import { CalendarDays, MapPin, Users } from 'lucide-react';

function formatTimeRange(start: Date, end: Date) {
  const s = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const e = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${s} – ${e}`;
}

export default function UpcomingMeetings() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.kakarot.calendar.listToday().then((res: CalendarEvent[]) => {
      setEvents(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl border border-white/30 dark:border-white/10 bg-white/70 dark:bg-[#0C0C0C]/70 backdrop-blur-md shadow-soft-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-emerald-mist dark:text-[#7C3AED]" />
          <p className="text-sm font-semibold">Coming up today</p>
        </div>
        {loading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading events…</p>
        )}
        {!loading && (!events || events.length === 0) && (
          <p className="text-sm text-slate-500 dark:text-slate-400">No events today.</p>
        )}
        {!loading && events && events.length > 0 && (
          <ul className="space-y-3">
            {events.map((evt) => (
              <li key={evt.id} className="rounded-xl px-4 py-3 bg-white/70 dark:bg-[#1A1A1A]/80 border border-white/30 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{evt.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimeRange(new Date(evt.start), new Date(evt.end))}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                      {evt.location && (
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {evt.location}</span>
                      )}
                      {evt.attendees && evt.attendees.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {evt.attendees.length} attendees</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
