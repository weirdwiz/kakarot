import { create } from 'zustand';
import type {
  Meeting,
  TranscriptSegment,
  RecordingState,
  AudioLevels,
  AppSettings,
  CalendarEvent,
} from '@shared/types';

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

  // Notes
  lastCompletedNoteId: string | null; // ID of last generated notes for navigation

  // Settings
  settings: AppSettings | null;

  // UI state
  view: 'recording' | 'history' | 'people' | 'settings';

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
}

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
  lastCompletedNoteId: null,
  settings: null,
  view: 'recording',

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

  setSettings: (settings) => set({ settings }),

  setView: (view) => set({ view }),

  setCurrentMeetingId: (currentMeetingId) => set({ currentMeetingId }),
}));
