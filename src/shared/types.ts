// Meeting and transcript types

export interface Meeting {
  id: string;
  title: string;
  createdAt: Date;
  endedAt: Date | null;
  duration: number; // in seconds
  transcript: TranscriptSegment[];
  summary: string | null;
  actionItems: string[];
  participants: string[];
}

export interface TranscriptWord {
  text: string;
  confidence: number;
  isFinal: boolean;
  start: number; // ms
  end: number; // ms
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number; // ms from start
  source: 'mic' | 'system'; // mic = user, system = others
  confidence: number;
  isFinal: boolean;
  words: TranscriptWord[];
  speakerId?: string; // for future diarization
}

export interface Callout {
  id: string;
  meetingId: string;
  triggeredAt: Date;
  question: string;
  context: string;
  suggestedResponse: string;
  sources: CalloutSource[];
  dismissed: boolean;
}

export interface CalloutSource {
  type: 'meeting' | 'file';
  title: string;
  excerpt: string;
  meetingId?: string;
  filePath?: string;
}

// Recording state
export type RecordingState = 'idle' | 'recording' | 'paused' | 'processing';

export interface AudioLevels {
  mic: number; // 0-1
  system: number; // 0-1
}

// Settings
export interface AppSettings {
  assemblyAiApiKey: string;
  openAiApiKey: string;
  knowledgeBasePath: string;
  autoDetectQuestions: boolean;
  showFloatingCallout: boolean;
  transcriptionLanguage: string;
  // Calendar OAuth credentials
  googleCalendarClientId?: string;
  googleCalendarClientSecret?: string;
  outlookCalendarClientId?: string;
  outlookCalendarClientSecret?: string;
  icloudCalendarUsername?: string;
  icloudCalendarPassword?: string; // App-specific password
}

// IPC payloads
export interface TranscriptUpdate {
  segment: TranscriptSegment;
  meetingId: string;
}

export interface CalloutTrigger {
  callout: Callout;
}

// Calendar
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  provider: 'google' | 'apple' | 'outlook' | 'unknown';
  location?: string;
  attendees?: string[];
  description?: string;
}

export interface CalendarTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export type CalendarProvider = 'google' | 'outlook' | 'icloud';

export interface CalendarConnectionStatus {
  google: boolean;
  outlook: boolean;
  icloud: boolean;
}
