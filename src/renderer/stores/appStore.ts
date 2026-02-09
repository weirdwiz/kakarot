import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  type Meeting,
  type TranscriptSegment,
  type RecordingState,
  type AudioLevels,
  type AppSettings,
  type CalendarEvent,
} from '@shared/types';

// Type for completed meetings displayed in dashboard
export type CompletedMeeting = Meeting & { endedAt: Date };

// Type for previous meeting display items
export interface PreviousMeetingItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  hasTranscript: boolean;
  isCalendarEvent: boolean;
}

interface AppState {
  // Recording state
  recordingState: RecordingState;
  audioLevels: AudioLevels;
  currentMeetingId: string | null;
  liveTranscript: TranscriptSegment[];
  currentPartials: {
    mic: TranscriptSegment | null;
    system: TranscriptSegment | null;
  };

  // Meetings
  meetings: Meeting[];
  selectedMeeting: Meeting | null;

  // Calendar context
  calendarContext: CalendarEvent | null;
  activeCalendarContext: CalendarEvent | null; // Calendar event actively being recorded for

  // Dashboard data (cached to avoid refetching on view switch)
  liveCalendarEvents: CalendarEvent[];
  upcomingCalendarEvents: CalendarEvent[];
  previousMeetings: PreviousMeetingItem[];
  calendarMappings: Record<string, { notesId?: string }>;
  dismissedEventIds: Set<string>;
  dashboardDataLoaded: boolean;

  // Notes
  lastCompletedNoteId: string | null; // ID of last generated notes for navigation

  // Settings (always initialized with defaults)
  settings: AppSettings;

  // UI state
  view: 'recording' | 'history' | 'people' | 'settings';
  showRecordingHome: boolean;
  recordingResult: 'completed' | 'error' | null;
  searchQuery: string | null; // For cross-view search navigation
  initialPrepQuery: string | null; // Pre-fill query for Prep omnibar when navigating from notes

  // Actions
  setRecordingState: (state: RecordingState) => void;
  setAudioLevels: (levels: AudioLevels) => void;
  setPartialSegment: (segment: TranscriptSegment) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateTranscriptSegment: (segment: TranscriptSegment) => void;
  clearLiveTranscript: () => void;
  setMeetings: (meetings: Meeting[]) => void;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  setCalendarContext: (event: CalendarEvent | null) => void;
  setActiveCalendarContext: (event: CalendarEvent | null) => void;
  setLastCompletedNoteId: (id: string | null) => void;
  setSettings: (settings: AppSettings) => void;
  setView: (view: 'recording' | 'history' | 'people' | 'settings') => void;
  setCurrentMeetingId: (id: string | null) => void;
  setShowRecordingHome: (value: boolean) => void;
  setRecordingResult: (value: 'completed' | 'error' | null) => void;
  setSearchQuery: (query: string | null) => void;
  setInitialPrepQuery: (query: string | null) => void;
  // Dashboard data actions
  setLiveCalendarEvents: (events: CalendarEvent[]) => void;
  setUpcomingCalendarEvents: (events: CalendarEvent[]) => void;
  setPreviousMeetings: (meetings: PreviousMeetingItem[]) => void;
  setCalendarMappings: (mappings: Record<string, { notesId?: string }>) => void;
  setDismissedEventIds: (ids: Set<string>) => void;
  addDismissedEventId: (id: string) => void;
  setDashboardDataLoaded: (loaded: boolean) => void;
}

// Load dismissed event IDs from localStorage
const loadDismissedEventIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem('dismissedEventIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  recordingState: 'idle',
  audioLevels: { mic: 0, system: 0 },
  currentMeetingId: null,
  liveTranscript: [],
  currentPartials: { mic: null, system: null },
  meetings: [],
  selectedMeeting: null,
  calendarContext: null,
  activeCalendarContext: null,
  // Dashboard cached data
  liveCalendarEvents: [],
  upcomingCalendarEvents: [],
  previousMeetings: [],
  calendarMappings: {},
  dismissedEventIds: loadDismissedEventIds(),
  dashboardDataLoaded: false,
  lastCompletedNoteId: null,
  settings: DEFAULT_SETTINGS,
  view: 'recording',
  showRecordingHome: false,
  recordingResult: null,
  searchQuery: null,
  initialPrepQuery: null,

  // Actions
  setRecordingState: (recordingState) => set({ recordingState }),

  setAudioLevels: (audioLevels) => set({ audioLevels }),

  setPartialSegment: (segment) =>
    set((state) => ({
      currentPartials: {
        ...state.currentPartials,
        [segment.source]: segment,
      },
    })),

  addTranscriptSegment: (segment) =>
    set((state) => {
      const existingIndex = state.liveTranscript.findIndex((s) => s.id === segment.id);
      const liveTranscript = existingIndex >= 0
        ? state.liveTranscript.map((s, i) => (i === existingIndex ? segment : s))
        : [...state.liveTranscript, segment];
      return {
        liveTranscript,
        currentPartials: {
          ...state.currentPartials,
          [segment.source]: null,
        },
      };
    }),

  updateTranscriptSegment: (segment) =>
    set((state) => ({
      liveTranscript: state.liveTranscript.map((s) =>
        s.id === segment.id ? segment : s
      ),
    })),

  clearLiveTranscript: () => set({ liveTranscript: [], currentPartials: { mic: null, system: null } }),

  setMeetings: (meetings) => set({ meetings }),

  setSelectedMeeting: (selectedMeeting) => set({ selectedMeeting }),

  setCalendarContext: (calendarContext) => set({ calendarContext }),

  setActiveCalendarContext: (activeCalendarContext) => set({ activeCalendarContext }),

  setLastCompletedNoteId: (lastCompletedNoteId) => set({ lastCompletedNoteId }),

  setSettings: (settings) => set({ settings: { ...DEFAULT_SETTINGS, ...settings } }),

  setView: (view) => set({ view }),

  setCurrentMeetingId: (currentMeetingId) => set({ currentMeetingId }),

  setShowRecordingHome: (showRecordingHome) => set({ showRecordingHome }),

  setRecordingResult: (recordingResult) => set({ recordingResult }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setInitialPrepQuery: (initialPrepQuery) => set({ initialPrepQuery }),

  // Dashboard data actions
  setLiveCalendarEvents: (liveCalendarEvents) => set({ liveCalendarEvents }),

  setUpcomingCalendarEvents: (upcomingCalendarEvents) => set({ upcomingCalendarEvents }),

  setPreviousMeetings: (previousMeetings) => set({ previousMeetings }),

  setCalendarMappings: (calendarMappings) => set({ calendarMappings }),

  setDismissedEventIds: (dismissedEventIds) => {
    localStorage.setItem('dismissedEventIds', JSON.stringify([...dismissedEventIds]));
    return set({ dismissedEventIds });
  },

  addDismissedEventId: (id) =>
    set((state) => {
      const updated = new Set([...state.dismissedEventIds, id]);
      localStorage.setItem('dismissedEventIds', JSON.stringify([...updated]));
      return { dismissedEventIds: updated };
    }),

  setDashboardDataLoaded: (dashboardDataLoaded) => set({ dashboardDataLoaded }),
}));
