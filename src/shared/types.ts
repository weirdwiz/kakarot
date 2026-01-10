// Meeting and transcript types

export interface MeetingChapter {
  title: string;
  startTime: number; // ms from start
  endTime: number;
  summary?: string;
}

export interface MeetingPerson {
  name: string;
  role?: string;
  notes?: string;
}

export interface Meeting {
  id: string;
  title: string;
  createdAt: Date;
  endedAt: Date | null;
  duration: number; // in seconds
  transcript: TranscriptSegment[];
  summary: string | null;
  notes: unknown | null;
  notesPlain: string | null;
  notesMarkdown: string | null;
  overview: string | null;
  chapters: MeetingChapter[];
  people: MeetingPerson[];
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
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  scope?: string;
  tokenType?: string;
  idToken?: string;
  email?: string;
}

export interface ICloudCredentials {
  appleId: string;
  appPassword: string;
  calendarHomeUrl?: string;
}

export interface CalendarConnections {
  google?: OAuthTokens;
  outlook?: OAuthTokens;
  icloud?: ICloudCredentials;
}

export type TranscriptionProvider = 'assemblyai' | 'deepgram';

export interface AppSettings {
  assemblyAiApiKey: string;
  deepgramApiKey: string;
  openAiApiKey: string;
  openAiBaseUrl: string;
  openAiModel: string;
  knowledgeBasePath: string;
  autoDetectQuestions: boolean;
  showFloatingCallout: boolean;
  transcriptionLanguage: string;
  transcriptionProvider: 'assemblyai' | 'deepgram';
  useHostedTokens: boolean;
  authApiBaseUrl: string;
  hostedAuthToken: string;
  calendarConnections: CalendarConnections;
  calendarEventMappings?: Record<string, CalendarEventMapping>;
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
  provider: 'google' | 'outlook' | 'icloud' | 'unknown';
  location?: string;
  attendees?: string[];
  description?: string;
}

// Enhanced calendar meeting with notes linking
export interface CalendarMeeting extends CalendarEvent {
  notesId?: string; // Links to recording/notes if available
  hasNotes: boolean; // Computed: true if notesId exists
}

// Mapping between calendar events and notes/recordings
export interface CalendarEventMapping {
  calendarEventId: string;
  meetingId?: string; // Our internal recording ID
  notesId?: string;
  linkedAt: number; // epoch ms
  provider: 'google' | 'outlook' | 'icloud';
}
