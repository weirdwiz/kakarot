import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { CalendarEvent, Meeting, AppSettings } from '@shared/types';
import { useAppStore } from '@renderer/stores/appStore';
import CompactMeetingBar from './CompactMeetingBar';
import UpcomingMeetingsList from './UpcomingMeetingsList';
import PreviousMeetingsList from './PreviousMeetingsList';

interface BentoDashboardProps {
  isRecording: boolean;
  hideCompactBarWhenNoEvents?: boolean;
  onStartNotes: (event?: CalendarEvent) => void;
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

type CompletedMeeting = Meeting & { endedAt: Date };

export default function BentoDashboard({ isRecording, hideCompactBarWhenNoEvents, onStartNotes, onSelectTab }: BentoDashboardProps): JSX.Element {
  const { setView, setSelectedMeeting, setCalendarContext, setActiveCalendarContext, recordingState } = useAppStore();
  const prevRecordingState = useRef(recordingState);
  const [liveEvents, setLiveEvents] = useState<CalendarEvent[]>([]);
  const [dismissedEventIds, setDismissedEventIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('dismissedEventIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [upcomingEventsWithoutNotes, setUpcomingEventsWithoutNotes] = useState<CalendarEvent[]>([]);
  const [previousMeetings, setPreviousMeetings] = useState<CompletedMeeting[]>([]);
  const [calendarMappings, setCalendarMappings] = useState<Record<string, any>>({});

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

      // Live bar: ALL events currently between start and end (not dismissed)
      const live = events.filter((e) => {
        const startMs = new Date(e.start).getTime();
        const endMs = new Date(e.end).getTime();
        return now >= startMs && now <= endMs && !dismissedEventIds.has(e.id);
      });
      setLiveEvents(live);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    }
  }, [dismissedEventIds]);

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

  // Refresh previous meetings when recording ends (transitions from recording to idle)
  useEffect(() => {
    if (prevRecordingState.current === 'recording' && recordingState === 'idle') {
      // Small delay to allow database to update
      setTimeout(() => {
        loadPreviousMeetings();
      }, 300);
    }
    prevRecordingState.current = recordingState;
  }, [recordingState, loadPreviousMeetings]);

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

  const handleDismissLiveMeeting = async (eventId: string) => {
    try {
      const event = liveEvents.find(e => e.id === eventId);
      if (!event) return;

      setDismissedEventIds(prev => {
        const updated = new Set([...prev, eventId]);
        localStorage.setItem('dismissedEventIds', JSON.stringify([...updated]));
        return updated;
      });

      await window.kakarot.meetings.createDismissed(
        event.title,
        event.attendees?.map((a: any) => typeof a === 'string' ? a : a.email)
      );

      await loadPreviousMeetings();
    } catch (err) {
      console.error('Failed to dismiss live meeting:', err);
      setDismissedEventIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        localStorage.setItem('dismissedEventIds', JSON.stringify([...next]));
        return next;
      });
    }
  };

  // Previous meetings: completed recorded meetings OR dismissed meetings
  // Filter out any that might be upcoming calendar events
  const now = Date.now();
  const allPreviousMeetings = previousMeetings
    .filter((m) => {
      // Show if it has ended (with or without transcript)
      if (!m.endedAt) return false;
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
          events={liveEvents}
          isRecording={isRecording}
          hideWhenNoEvents={hideCompactBarWhenNoEvents}
          onStartNotes={onStartNotes}
          onPrep={() => onSelectTab?.('prep')}
          onDismiss={handleDismissLiveMeeting}
        />
      </div>

      {/* Two-column layout: Upcoming | Previous (responsive) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2.5 min-h-0 overflow-auto">
        <UpcomingMeetingsList
          meetings={upcomingEventsWithoutNotes}
          onNavigateSettings={handleNavigateSettings}
          onSelectMeeting={handleSelectUpcomingMeeting}
          onTakeNotes={handleTakeManualNotes}
          onNavigateInteract={() => onSelectTab?.('interact')}
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
