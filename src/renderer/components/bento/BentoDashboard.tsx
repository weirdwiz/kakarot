import React, { useEffect, useState } from 'react';
import type { CalendarEvent, CalendarListResult } from '@shared/types';
import CompactMeetingBar from './CompactMeetingBar';
import UpcomingMeetingsList from './UpcomingMeetingsList';
import PreviousMeetingsList from './PreviousMeetingsList';

interface BentoDashboardProps {
  isRecording: boolean;
  onStartNotes: () => void;
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

export default function BentoDashboard({ isRecording, onStartNotes, onSelectTab }: BentoDashboardProps) {
  const [upcomingEvent, setUpcomingEvent] = useState<CalendarEvent | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Placeholder meetings shown when no calendar connected
  const placeholderMeetings: CalendarEvent[] = [
    {
      id: 'placeholder-1',
      title: 'Connect your calendar',
      start: new Date(Date.now() + 7200000),
      end: new Date(Date.now() + 10800000),
      provider: 'google',
      location: 'Settings',
    },
  ];

  // Mock previous meetings (placeholder)
  const mockPreviousMeetings = [
    {
      id: 'prev-1',
      title: 'Sprint Planning',
      start: new Date(Date.now() - 86400000),
      end: new Date(Date.now() - 82800000),
      hasTranscript: true,
    },
    {
      id: 'prev-2',
      title: 'Design Review',
      start: new Date(Date.now() - 172800000),
      end: new Date(Date.now() - 169200000),
      hasTranscript: true,
    },
    {
      id: 'prev-3',
      title: 'Client Check-in',
      start: new Date(Date.now() - 259200000),
      end: new Date(Date.now() - 255600000),
      hasTranscript: false,
    },
  ];

  useEffect(() => {
    window.kakarot.calendar.listToday().then((result: CalendarListResult) => {
      setCalendarEvents(result.events);
      if (result.events.length > 0) {
        setUpcomingEvent(result.events[0]);
      }
    });
  }, []);

  const handleViewNotes = (_meetingId: string) => {
    // TODO: Navigate to meeting notes view
  };

  return (
    <div className="h-full flex flex-col gap-2.5 p-3">
      {/* Compact meeting bar at top */}
      <div className="flex-shrink-0">
        <CompactMeetingBar
          event={upcomingEvent}
          isRecording={isRecording}
          onStartNotes={onStartNotes}
          onPrep={() => onSelectTab?.('prep')}
        />
      </div>

      {/* Two-column layout: Upcoming | Previous */}
      <div className="flex-1 grid grid-cols-2 gap-2.5 min-h-0">
        <UpcomingMeetingsList meetings={calendarEvents.length > 0 ? calendarEvents : placeholderMeetings} />
        <PreviousMeetingsList meetings={mockPreviousMeetings} onViewNotes={handleViewNotes} />
      </div>
    </div>
  );
}
