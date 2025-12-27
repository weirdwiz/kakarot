import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import type {
  Meeting,
  AppSettings,
  RecordingState,
  AudioLevels,
  TranscriptUpdate,
  Callout,
  CalendarEvent,
  CalendarConnections,
} from '@shared/types';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('kakarot', {
  // Recording controls
  recording: {
    start: (calendarContext?: {
      calendarEventId: string;
      calendarEventTitle: string;
      calendarEventAttendees?: string[];
      calendarEventStart: string;
      calendarEventEnd: string;
      calendarProvider: string;
    }) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_START, calendarContext),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_STOP),
    pause: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_PAUSE),
    resume: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_RESUME),
    onStateChange: (callback: (state: RecordingState) => void) => {
      const handler = (_: unknown, state: RecordingState) => callback(state);
      ipcRenderer.on(IPC_CHANNELS.RECORDING_STATE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_STATE, handler);
    },
    onNotesComplete: (callback: (data: { meetingId: string; title: string; overview: string }) => void) => {
      const handler = (_: unknown, data: { meetingId: string; title: string; overview: string }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.MEETING_NOTES_COMPLETE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MEETING_NOTES_COMPLETE, handler);
    },
  },

  // Audio
  audio: {
    onLevels: (callback: (levels: AudioLevels) => void) => {
      const handler = (_: unknown, levels: AudioLevels) => callback(levels);
      ipcRenderer.on(IPC_CHANNELS.AUDIO_LEVELS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_LEVELS, handler);
    },
    // Send microphone audio data (system audio handled by main process via AudioTee)
    sendData: (audioData: ArrayBuffer, source: 'mic' | 'system') => {
      ipcRenderer.send(IPC_CHANNELS.AUDIO_DATA, audioData, source);
    },
    getSources: (): Promise<Array<{ id: string; name: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_SOURCES),
  },

  // Transcription
  transcript: {
    onUpdate: (callback: (update: TranscriptUpdate) => void) => {
      const handler = (_: unknown, update: TranscriptUpdate) => callback(update);
      ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_UPDATE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPT_UPDATE, handler);
    },
    onFinal: (callback: (update: TranscriptUpdate) => void) => {
      const handler = (_: unknown, update: TranscriptUpdate) => callback(update);
      ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_FINAL, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPT_FINAL, handler);
    },
  },

  // Meetings
  meetings: {
    list: (): Promise<Meeting[]> => ipcRenderer.invoke(IPC_CHANNELS.MEETINGS_LIST),
    get: (id: string): Promise<Meeting | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETINGS_GET, id),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETINGS_DELETE, id),
    search: (query: string): Promise<Meeting[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETINGS_SEARCH, query),
    summarize: (id: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_SUMMARIZE, id),
    export: (id: string, format: 'markdown' | 'pdf'): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_EXPORT, id, format),
    saveManualNotes: (id: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_NOTES_SAVE_MANUAL, id, content),
    askNotes: (id: string, query: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_ASK_NOTES, id, query),
  },

  // Callout
  callout: {
    onShow: (callback: (callout: Callout) => void) => {
      const handler = (_: unknown, callout: Callout) => callback(callout);
      ipcRenderer.on(IPC_CHANNELS.CALLOUT_SHOW, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CALLOUT_SHOW, handler);
    },
    dismiss: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALLOUT_DISMISS, id),
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (settings: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, settings),
  },

  // Knowledge base
  knowledge: {
    index: (path: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_INDEX, path),
    search: (query: string): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SEARCH, query),
  },

  // Calendar
  calendar: {
    connect: (
      provider: 'google' | 'outlook' | 'icloud',
      payload?: { appleId: string; appPassword: string }
    ): Promise<CalendarConnections> => ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_CONNECT, provider, payload),
    disconnect: (provider: 'google' | 'outlook' | 'icloud'): Promise<CalendarConnections> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_DISCONNECT, provider),
    listToday: (): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_LIST_TODAY),
    getUpcoming: (): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_GET_UPCOMING),
    linkEvent: (calendarEventId: string, meetingId: string, provider: 'google' | 'outlook' | 'icloud'): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_LINK_EVENT, calendarEventId, meetingId, provider),
    getEventForMeeting: (meetingId: string): Promise<CalendarEvent | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_GET_EVENT_FOR_MEETING, meetingId),
    linkNotes: (calendarEventId: string, notesId: string, provider: 'google' | 'outlook' | 'icloud'): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_LINK_NOTES, calendarEventId, notesId, provider),
    listCalendars: (provider: 'google' | 'outlook' | 'icloud'): Promise<Array<{ id: string; name: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_LIST_CALENDARS, provider),
    setVisibleCalendars: (provider: 'google' | 'outlook' | 'icloud', ids: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_SET_VISIBLE_CALENDARS, provider, ids),
  },

  // Dev utilities
  dev: {
    onResetOnboarding: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('dev:reset-onboarding', handler);
      return () => ipcRenderer.removeListener('dev:reset-onboarding', handler);
    },
  },
});

// TypeScript declaration for window.kakarot
declare global {
  interface Window {
    kakarot: {
      recording: {
        start: (calendarContext?: {
          calendarEventId: string;
          calendarEventTitle: string;
          calendarEventAttendees?: string[];
          calendarEventStart: string;
          calendarEventEnd: string;
          calendarProvider: string;
        }) => Promise<string>;
        stop: () => Promise<Meeting>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        onStateChange: (callback: (state: RecordingState) => void) => () => void;
        onNotesComplete: (callback: (data: { meetingId: string; title: string; overview: string }) => void) => () => void;
      };
      audio: {
        onLevels: (callback: (levels: AudioLevels) => void) => () => void;
        sendData: (audioData: ArrayBuffer, source: 'mic' | 'system') => void;
        getSources: () => Promise<Array<{ id: string; name: string }>>;
      };
      transcript: {
        onUpdate: (callback: (update: TranscriptUpdate) => void) => () => void;
        onFinal: (callback: (update: TranscriptUpdate) => void) => () => void;
      };
      meetings: {
        list: () => Promise<Meeting[]>;
        get: (id: string) => Promise<Meeting | null>;
        delete: (id: string) => Promise<void>;
        search: (query: string) => Promise<Meeting[]>;
        summarize: (id: string) => Promise<string>;
        export: (id: string, format: 'markdown' | 'pdf') => Promise<string>;
        saveManualNotes: (id: string, content: string) => Promise<void>;
        askNotes: (id: string, query: string) => Promise<string>;
      };
      callout: {
        onShow: (callback: (callout: Callout) => void) => () => void;
        dismiss: (id: string) => Promise<void>;
      };
      settings: {
        get: () => Promise<AppSettings>;
        update: (settings: Partial<AppSettings>) => Promise<void>;
      };
      knowledge: {
        index: (path: string) => Promise<void>;
        search: (query: string) => Promise<unknown[]>;
      };
      calendar: {
        connect: (
          provider: 'google' | 'outlook' | 'icloud',
          payload?: { appleId: string; appPassword: string }
        ) => Promise<CalendarConnections>;
        disconnect: (provider: 'google' | 'outlook' | 'icloud') => Promise<CalendarConnections>;
        listToday: () => Promise<CalendarEvent[]>;
        getUpcoming: () => Promise<CalendarEvent[]>;
        linkEvent: (calendarEventId: string, meetingId: string, provider: 'google' | 'outlook' | 'icloud') => Promise<void>;
        getEventForMeeting: (meetingId: string) => Promise<CalendarEvent | null>;
        linkNotes: (calendarEventId: string, notesId: string, provider: 'google' | 'outlook' | 'icloud') => Promise<void>;
        listCalendars: (provider: 'google' | 'outlook' | 'icloud') => Promise<Array<{ id: string; name: string }>>;
        setVisibleCalendars: (provider: 'google' | 'outlook' | 'icloud', ids: string[]) => Promise<void>;
      };
      dev: {
        onResetOnboarding: (callback: () => void) => () => void;
      };
    };
  }
}
