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
<<<<<<< HEAD
  transcriptionProvider: TranscriptionProvider;
  // Calendar OAuth credentials
  googleCalendarClientId?: string;
  googleCalendarClientSecret?: string;
  outlookCalendarClientId?: string;
  outlookCalendarClientSecret?: string;
  icloudCalendarUsername?: string;
  icloudCalendarPassword?: string; // App-specific password
  calendarConnections?: CalendarConnections;
  calendarEventMappings?: Record<string, string>; // meetingId -> calendarEventId
=======
  transcriptionProvider: 'assemblyai' | 'deepgram';
  useHostedTokens: boolean;
  authApiBaseUrl: string;
  hostedAuthToken: string;
  calendarConnections: CalendarConnections;
  calendarEventMappings?: Record<string, CalendarEventMapping>;
>>>>>>> 24b5726f2d857d558a8da9f0fa4c9fe860b76865
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

<<<<<<< HEAD
export interface GoogleCalendarResponse {
  items?: GoogleCalendarItem[];
}

export interface OutlookCalendarItem {
  id: string;
  subject?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: { displayName?: string };
  attendees?: { emailAddress: { address: string } }[];
  bodyPreview?: string;
}

export interface OutlookCalendarResponse {
  value?: OutlookCalendarItem[];
}

// Calendar fetch result with error handling
export interface CalendarFetchResult {
  events: CalendarEvent[];
  error?: string;
}

// Calendar list result with errors from multiple providers
export interface CalendarListResult {
  events: CalendarEvent[];
  errors: string[];
}

export interface CalendarTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in milliseconds
  scope?: string;
}

export type OAuthTokens = CalendarTokens;

export interface CalendarConnections {
  google?: CalendarTokens;
  outlook?: CalendarTokens;
  icloud?: { username: string; password: string };
}

export interface CalendarConnectionStatus {
  google: boolean;
  outlook: boolean;
  icloud: boolean;
=======
// Mapping between calendar events and notes/recordings
export interface CalendarEventMapping {
  calendarEventId: string;
  meetingId?: string; // Our internal recording ID
  notesId?: string;
  linkedAt: number; // epoch ms
  provider: 'google' | 'outlook' | 'icloud';
>>>>>>> 24b5726f2d857d558a8da9f0fa4c9fe860b76865
}
