import React, { useEffect, useCallback, useState } from 'react';
import { useAppStore, type PreviousMeetingItem } from './stores/appStore';
import { useOnboardingStore } from './stores/onboardingStore';
import RecordingView from './components/RecordingView';
import PrepView from './components/PrepView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import PeopleView from './components/PeopleView';
import Sidebar from './components/Sidebar';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import { ArrowLeft } from 'lucide-react';
import type { AudioLevels, AppSettings, CalendarEvent, Meeting } from '../shared/types';
import ThemeToggle from './components/ThemeToggle';
import ToastContainer from './components/Toast';

export default function App() {
  const {
    view,
    recordingState,
    setRecordingState,
    setAudioLevels,
    setPartialSegment,
    addTranscriptSegment,
    setSettings,
    setLiveCalendarEvents,
    setUpcomingCalendarEvents,
    setPreviousMeetings,
    setCalendarMappings,
    setDashboardDataLoaded,
    dashboardDataLoaded,
    dismissedEventIds,
    showRecordingHome,
    recordingResult,
  } = useAppStore();
  const { isCompleted: onboardingCompleted, completeOnboarding, resetOnboarding } = useOnboardingStore();
  const [pillarTab, setPillarTab] = useState<'notes' | 'prep'>('notes');
  const [cachedCalendarEvents, setCachedCalendarEvents] = useState<CalendarEvent[]>([]);

  const classifyCalendarEvents = useCallback(
    (events: CalendarEvent[], dismissedIds: Set<string>) => {
      const now = Date.now();
      const oneMinute = 60_000;
      const upcoming = events.filter((event) => {
        const eventStart = new Date(event.start).getTime();
        const status = event.status?.toLowerCase();
        const isCancelled = event.isCancelled || status === 'cancelled';
        return !isCancelled && eventStart - now > oneMinute;
      });

      const live = events.filter((event) => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        const status = event.status?.toLowerCase();
        const isCancelled = event.isCancelled || status === 'cancelled';
        if (isCancelled) {
          return false;
        }
        const windowStart = eventStart - oneMinute;
        const isWithinWindow = now >= windowStart && now <= eventEnd;
        return isWithinWindow && !dismissedIds.has(event.id);
      });

      setUpcomingCalendarEvents(upcoming);
      setLiveCalendarEvents(live);
    },
    [setLiveCalendarEvents, setUpcomingCalendarEvents]
  );

  useEffect(() => {
    classifyCalendarEvents(cachedCalendarEvents, dismissedEventIds);
  }, [cachedCalendarEvents, dismissedEventIds, classifyCalendarEvents]);

  useEffect(() => {
    if (cachedCalendarEvents.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      classifyCalendarEvents(cachedCalendarEvents, dismissedEventIds);
    }, 5000);

    return () => clearInterval(interval);
  }, [cachedCalendarEvents, dismissedEventIds, classifyCalendarEvents]);

  // Determine if we need full-height layout (no scrolling, card fills space)
  const isLiveRecording = recordingState === 'recording' || recordingState === 'paused';
  const needsFullHeight = view === 'history' || view === 'people' || (view === 'recording' && (isLiveRecording || pillarTab === 'prep'));

  // Handler that merges incoming audio levels with existing state
  // This allows main process to send partial updates (e.g., just { system: level })
  const handleAudioLevels = useCallback((levels: Partial<AudioLevels>) => {
    const currentLevels = useAppStore.getState().audioLevels;
    setAudioLevels({
      ...currentLevels,
      ...levels,
    });
  }, [setAudioLevels]);

  // Load dashboard data (calendar events and previous meetings)
  const loadDashboardData = useCallback(async () => {
    const currentDismissedIds = useAppStore.getState().dismissedEventIds;

    try {
      // Load calendar events
      const events = await window.kakarot.calendar.getUpcoming();
      setCachedCalendarEvents(events);

      // Immediately classify the freshly fetched events
      classifyCalendarEvents(events, currentDismissedIds);

      // Load calendar mappings
      const settings = await window.kakarot.settings.get() as AppSettings;
      const mappings = settings.calendarEventMappings || {};
      setCalendarMappings(mappings);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    }

    try {
      // Load previous meetings
      const meetings = await window.kakarot.meetings.list();
      const now = Date.now();
      const completed = meetings
        .filter((m): m is Meeting & { endedAt: Date } => m.endedAt !== null)
        .filter((m) => new Date(m.endedAt).getTime() < now)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((m): PreviousMeetingItem => ({
          id: m.id,
          title: m.title,
          start: new Date(m.createdAt),
          end: new Date(m.endedAt),
          hasTranscript: m.transcript.length > 0,
          isCalendarEvent: false,
        }));
      setPreviousMeetings(completed);
    } catch (err) {
      console.error('Failed to load previous meetings:', err);
    }

    setDashboardDataLoaded(true);
  }, [classifyCalendarEvents, setPreviousMeetings, setCalendarMappings, setDashboardDataLoaded]);

  useEffect(() => {
    // Load initial settings
    window.kakarot.settings.get().then(setSettings);

    // Dev-only: Listen for onboarding reset shortcut (Cmd/Ctrl+Shift+O)
    const unsubDevReset = window.kakarot.dev.onResetOnboarding(() => {
      console.log('[DEV] Resetting onboarding via keyboard shortcut');
      resetOnboarding();
    });

    // Subscribe to recording state changes
    const unsubState = window.kakarot.recording.onStateChange(setRecordingState);

    // Subscribe to audio levels (handler merges partial updates)
    const unsubLevels = window.kakarot.audio.onLevels(handleAudioLevels);

    // Subscribe to transcript updates (partials replace, finals append)
    const unsubTranscript = window.kakarot.transcript.onUpdate((update) => {
      setPartialSegment(update.segment);
    });

    const unsubFinal = window.kakarot.transcript.onFinal((update) => {
      addTranscriptSegment(update.segment);
    });

    return () => {
      unsubDevReset();
      unsubState();
      unsubLevels();
      unsubTranscript();
      unsubFinal();
    };
  }, [setRecordingState, handleAudioLevels, setPartialSegment, addTranscriptSegment, setSettings, resetOnboarding]);

  // Load dashboard data at startup and refresh periodically
  useEffect(() => {
    // Initial load
    loadDashboardData();

    // Refresh every 30 seconds to keep live/upcoming meetings current
    const intervalId = setInterval(loadDashboardData, 30_000);

    // Listen for notes completion to refresh previous meetings
    const unsubNotesComplete = window.kakarot.recording.onNotesComplete?.(() => {
      setTimeout(loadDashboardData, 500);
    });

    // Listen for settings changes (including calendar visibility toggles) to refresh immediately
    const unsubSettingsChange = window.kakarot.settings.onChange?.((settings: AppSettings) => {
      // Small delay to ensure backend has processed the change
      setTimeout(loadDashboardData, 100);
    });

    return () => {
      clearInterval(intervalId);
      if (unsubNotesComplete) unsubNotesComplete();
      if (unsubSettingsChange) unsubSettingsChange();
    };
  }, [loadDashboardData]);

  // Track previous recording state to detect when recording ends
  const prevRecordingStateRef = React.useRef(recordingState);
  useEffect(() => {
    // Refresh dashboard data when recording ends (transitions from recording to idle)
    if (prevRecordingStateRef.current === 'recording' && recordingState === 'idle' && dashboardDataLoaded) {
      setTimeout(loadDashboardData, 300);
    }
    prevRecordingStateRef.current = recordingState;
  }, [recordingState, dashboardDataLoaded, loadDashboardData]);

  // Show onboarding if not completed
  if (!onboardingCompleted) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return (
    <div className="flex h-screen overflow-hidden min-w-[640px] bg-[#0C0C0C]">
      <Sidebar pillarTab={pillarTab} onPillarTabChange={setPillarTab} />
      <div className="flex-1 flex flex-col">
        {/* Fixed Header */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0C0C0C]/80 border-b border-[#2A2A2A] drag-region">
          <div className="px-4 sm:px-6 h-[48px] flex items-center">
            <div className="flex items-center no-drag">
              {(() => {
                const state = useAppStore.getState();
                const isOnHomepage = view === 'recording' &&
                                    pillarTab === 'notes' &&
                                    !state.selectedMeeting &&
                                    !state.activeCalendarContext &&
                                    !recordingResult &&
                                    (recordingState === 'idle' || showRecordingHome);

                return (
                  <button
                    disabled={isOnHomepage}
                    className={`px-3 py-1.5 rounded-md text-sm transition ${
                      isOnHomepage
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-300 hover:bg-white/5 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (isOnHomepage) return;
                      const state = useAppStore.getState();
                      const currentlyLive = state.recordingState === 'recording' || state.recordingState === 'paused';

                      state.setView('recording');
                      setPillarTab('notes');
                      state.setActiveCalendarContext(null);
                      state.setCalendarContext(null);
                      state.setSelectedMeeting(null);
                      state.setShowRecordingHome(currentlyLive);
                      state.setRecordingResult(null);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className={`flex-1 ${needsFullHeight ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div
            key={`${view}-${pillarTab}`}
            className={`
              animate-view-enter
              ${needsFullHeight ? 'h-full flex flex-col' : ''}
              py-4 px-4 sm:px-6
              ${!(view === 'history' || view === 'people') ? 'max-w-5xl mx-auto' : ''}
            `}
          >
            {(view === 'history' || view === 'people') ? (
              <div className={needsFullHeight ? 'flex-1 min-h-0' : ''}>
                {view === 'history' && <HistoryView />}
                {view === 'people' && <PeopleView />}
              </div>
            ) : (
              <div className={`rounded-2xl border border-[#2A2A2A] bg-[#161616] ${needsFullHeight ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
                <div className={`${needsFullHeight ? 'h-full flex flex-col p-5' : 'p-5 sm:p-6'}`}>
                  {view === 'recording' && (
                    pillarTab === 'notes' ? (
                      <RecordingView onSelectTab={setPillarTab} />
                    ) : (
                      <PrepView onSelectTab={setPillarTab} />
                    )
                  )}
                  {view === 'settings' && <SettingsView />}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <ToastContainer />
      <ThemeToggle />
    </div>
  );
}
