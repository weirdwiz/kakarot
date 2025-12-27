import React, { useEffect, useState, useCallback } from 'react';
import type { CalendarEvent, CalendarListResult, Meeting } from '@shared/types';
import { useAppStore } from '@renderer/stores/appStore';
import CompactMeetingBar from './CompactMeetingBar';
import UpcomingMeetingsList from './UpcomingMeetingsList';
import PreviousMeetingsList from './PreviousMeetingsList';

interface BentoDashboardProps {
  isRecording: boolean;
  onStartNotes: () => void;
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

type CompletedMeeting = Meeting & { endedAt: Date };

export default function BentoDashboard({ isRecording, onStartNotes, onSelectTab }: BentoDashboardProps): JSX.Element {
  const { setView, setSelectedMeeting } = useAppStore();
  const [upcomingEvent, setUpcomingEvent] = useState<CalendarEvent | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [previousMeetings, setPreviousMeetings] = useState<CompletedMeeting[]>([]);

  const loadPreviousMeetings = useCallback(async () => {
    try {
      const meetings = await window.kakarot.meetings.list();
      const completed = meetings
        .filter((m): m is CompletedMeeting => m.endedAt !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setPreviousMeetings(completed);
    } catch (err) {
      console.error('Failed to load previous meetings:', err);
    }
  }, []);

  useEffect(() => {
    window.kakarot.calendar.listToday()
      .then((result: CalendarListResult) => {
        setCalendarEvents(result.events);
        if (result.events.length > 0) {
          setUpcomingEvent(result.events[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to load calendar events:', err);
      });
    loadPreviousMeetings();
  }, [loadPreviousMeetings]);

  const handleViewNotes = async (meetingId: string) => {
    try {
      const meeting = await window.kakarot.meetings.get(meetingId);
      if (meeting) {
        setSelectedMeeting(meeting);
        setView('history');
      }
    } catch (err) {
      console.error('Failed to load meeting:', err);
    }
  };

  const handleNavigateSettings = () => {
    setView('settings');
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
        <UpcomingMeetingsList
          meetings={calendarEvents}
          onNavigateSettings={handleNavigateSettings}
        />
        <PreviousMeetingsList
          meetings={previousMeetings.map((m) => ({
            id: m.id,
            title: m.title,
            start: new Date(m.createdAt),
            end: new Date(m.endedAt),
            hasTranscript: m.transcript.length > 0,
          }))}
          onViewNotes={handleViewNotes}
        />
      </div>
    </div>
  );
}
