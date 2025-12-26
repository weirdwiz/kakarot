import React, { useEffect, useState } from 'react';
import type { CalendarEvent } from '../../../shared/types';
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

  // Mock upcoming meetings (placeholder)
  const mockUpcomingMeetings: CalendarEvent[] = [
    {
      id: '1',
      title: 'Product Roadmap Review',
      start: new Date(Date.now() + 7200000),
      end: new Date(Date.now() + 10800000),
      provider: 'zoom',
      location: 'Zoom',
    },
    {
      id: '2',
      title: 'Engineering Standup',
      start: new Date(Date.now() + 18000000),
      end: new Date(Date.now() + 19800000),
      provider: 'meet',
      location: 'Google Meet',
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
    window.kakarot.calendar.listToday().then((events) => {
      if (events.length > 0) {
        setUpcomingEvent(events[0]);
      }
    });
  }, []);

  const handleViewNotes = (meetingId: string) => {
    console.log('View notes for meeting:', meetingId);
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
        <UpcomingMeetingsList meetings={mockUpcomingMeetings} />
        <PreviousMeetingsList meetings={mockPreviousMeetings} onViewNotes={handleViewNotes} />
      </div>
    </div>
  );
}
