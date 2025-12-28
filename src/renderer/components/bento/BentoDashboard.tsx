import React, { useEffect, useState, useCallback } from 'react';
import type { CalendarEvent, Meeting, AppSettings } from '@shared/types';
import { useAppStore } from '@renderer/stores/appStore';
import CompactMeetingBar from './CompactMeetingBar';
import UpcomingMeetingsList from './UpcomingMeetingsList';
import PreviousMeetingsList from './PreviousMeetingsList';

interface BentoDashboardProps {
  isRecording: boolean;
  onStartNotes: (event?: CalendarEvent) => void;
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

type CompletedMeeting = Meeting & { endedAt: Date };

export default function BentoDashboard({ isRecording, onStartNotes, onSelectTab }: BentoDashboardProps): JSX.Element {
  const { setView, setSelectedMeeting, setCalendarContext, setActiveCalendarContext } = useAppStore();
  const [upcomingEvent, setUpcomingEvent] = useState<CalendarEvent | null>(null);
  const [upcomingEventsWithoutNotes, setUpcomingEventsWithoutNotes] = useState<CalendarEvent[]>([]);
  const [previousMeetings, setPreviousMeetings] = useState<CompletedMeeting[]>([]);
  const [calendarMappings, setCalendarMappings] = useState<Record<string, any>>({});

  const loadPreviousMeetings = useCallback(async () => {
    try {
      const meetings = await window.kakarot.meetings.list();
      const completed = meetings
        .filter((m): m is CompletedMeeting => m.endedAt !== null && m.transcript.length > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setPreviousMeetings(completed);
    } catch (err) {
      console.error('Failed to load previous meetings:', err);
    }
  }, []);

  const loadCalendarMappings = useCallback(async () => {
    try {
      const settings = await window.kakarot.settings.get();
      const mappings = (settings as AppSettings).calendarEventMappings || {};
      setCalendarMappings(mappings);
    } catch (err) {
      console.error('Failed to load calendar mappings:', err);
    }
  }, []);

  const loadUpcomingMeetings = useCallback(async () => {
    try {
      const events = await window.kakarot.calendar.getUpcoming();
      
      // Load calendar mappings (for view behavior), but do not exclude events with notes from Upcoming
      const mappings = await (async () => {
        try {
          const settings = await window.kakarot.settings.get();
          return (settings as AppSettings).calendarEventMappings || {};
        } catch {
          return {};
        }
      })();
      setCalendarMappings(mappings);

      const now = Date.now();
      const oneMinute = 60_000;

      // Upcoming section: events whose start is more than 1 minute away
      const upcoming = events.filter((e) => new Date(e.start).getTime() - now > oneMinute);
      setUpcomingEventsWithoutNotes(upcoming);

      // Live bar: first event currently between start and end
      const live = events.find((e) => {
        const startMs = new Date(e.start).getTime();
        const endMs = new Date(e.end).getTime();
        return now >= startMs && now <= endMs;
      }) || null;
      setUpcomingEvent(live);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    }
  }, []);

  useEffect(() => {
    loadUpcomingMeetings();
    loadPreviousMeetings();
    loadCalendarMappings();
  }, [loadUpcomingMeetings, loadPreviousMeetings, loadCalendarMappings]);

  // Listen for notes completion and refresh previous meetings
  useEffect(() => {
    const unsubscribe = window.kakarot.recording.onNotesComplete?.(() => {
      setTimeout(() => {
        loadPreviousMeetings();
      }, 500);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
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

  const handleViewCalendarEventNotes = async (calendarEventId: string) => {
    try {
      const mapping = calendarMappings[calendarEventId];
      if (mapping?.notesId) {
        await handleViewNotes(mapping.notesId);
      }
    } catch (err) {
      console.error('Failed to view calendar event notes:', err);
    }
  };

  const handleNavigateSettings = () => {
    setView('settings');
  };

  /**
   * Handle clicking on an upcoming meeting (Prep button)
   * Prepares to record with this calendar context
   */
  const handleSelectUpcomingMeeting = (event: CalendarEvent) => {
    const hasNotes = calendarMappings[event.id]?.notesId;
    
    if (hasNotes) {
      // View existing notes
      handleViewCalendarEventNotes(event.id);
    } else {
      // Prepare to record with this calendar context
      setCalendarContext(event);
      setActiveCalendarContext(event);
      setView('recording');
      onSelectTab?.('prep');
    }
  };

  /**
   * Handle taking manual notes on an upcoming meeting (Take Notes button)
   * Opens manual notes interface without audio recording
   */
  const handleTakeManualNotes = (event: CalendarEvent) => {
    setCalendarContext(event);
    setActiveCalendarContext(event);
    setView('recording');
    onSelectTab?.('notes');
  };

  // Previous meetings: only completed recorded meetings with transcripts
  // Filter out any that might be upcoming calendar events
  const now = Date.now();
  const allPreviousMeetings = previousMeetings
    .filter((m) => {
      // Only show if it has ended and has transcript
      if (!m.endedAt || m.transcript.length === 0) return false;
      // Only show if end time is in the past
      const endTime = new Date(m.endedAt).getTime();
      return endTime < now;
    })
    .map((m) => ({
      id: m.id,
      title: m.title,
      start: new Date(m.createdAt),
      end: new Date(m.endedAt),
      hasTranscript: m.transcript.length > 0,
      isCalendarEvent: false,
    }))
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .slice(0, 5);

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
          meetings={upcomingEventsWithoutNotes}
          onNavigateSettings={handleNavigateSettings}
          onSelectMeeting={handleSelectUpcomingMeeting}
          onTakeNotes={handleTakeManualNotes}
        />
        <PreviousMeetingsList
          meetings={allPreviousMeetings}
          onViewNotes={handleViewNotes}
          onViewCalendarEventNotes={handleViewCalendarEventNotes}
        />
      </div>
    </div>
  );
}
