import { create } from 'zustand';
import type {
  Meeting,
  TranscriptSegment,
  RecordingState,
  AudioLevels,
  AppSettings,
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

  // Settings
  settings: AppSettings | null;

  // UI state
  view: 'recording' | 'history' | 'settings';

  // Actions
  setRecordingState: (state: RecordingState) => void;
  setAudioLevels: (levels: AudioLevels) => void;
  setPartialSegment: (segment: TranscriptSegment) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateTranscriptSegment: (segment: TranscriptSegment) => void;
  clearLiveTranscript: () => void;
  setMeetings: (meetings: Meeting[]) => void;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  setSettings: (settings: AppSettings) => void;
  setView: (view: 'recording' | 'history' | 'settings') => void;
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
    set((state) => ({
      liveTranscript: [...state.liveTranscript, segment],
      currentPartials: {
        ...state.currentPartials,
        [segment.source]: null,
      },
    })),

  updateTranscriptSegment: (segment) =>
    set((state) => ({
      liveTranscript: state.liveTranscript.map((s) =>
        s.id === segment.id ? segment : s
      ),
    })),

  clearLiveTranscript: () => set({ liveTranscript: [], currentPartials: { mic: null, system: null } }),

  setMeetings: (meetings) => set({ meetings }),

  setSelectedMeeting: (selectedMeeting) => set({ selectedMeeting }),

  setSettings: (settings) => set({ settings }),

  setView: (view) => set({ view }),

  setCurrentMeetingId: (currentMeetingId) => set({ currentMeetingId }),
}));
