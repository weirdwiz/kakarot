// Meeting and transcript types

export interface NoteEntry {
  id: string;
  content: string;
  type: 'manual' | 'generated'; // manual = typed by user, generated = from AI
  createdAt: Date;
  source?: 'upcoming' | 'live'; // where it was created
}

export interface Person {
  email: string; // Primary identifier
  name?: string; // Extracted from calendar or user input
  lastMeetingAt: Date;
  meetingCount: number;
  totalDuration: number; // Total minutes met
  notes?: string; // User-added context about this person
  organization?: string;
}

export interface Meeting {
  id: string;
  title: string;
  createdAt: Date;
  endedAt: Date | null;
  duration: number; // in seconds
  transcript: TranscriptSegment[];
  summary?: string | null;
  actionItems: string[];
  participants: string[]; // Deprecated: use attendeeEmails
  attendeeEmails: string[]; // Email addresses from calendar
  // Note entries (accumulated with timestamps)
  noteEntries: NoteEntry[];
  // Optional generated notes fields (legacy, for backward compatibility)
  overview: string | null;
  notesMarkdown: string | null;
  notesPlain: string | null;
  notes: unknown | null;
  chapters: unknown[];
  people: unknown[];
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
  // User profile info
  userName?: string;
  userEmail?: string;
  userPhoto?: string;
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

export type CRMProvider = 'salesforce' | 'hubspot';
export type CRMNotesBehavior = 'always' | 'ask';

export interface SalesforceOAuthToken {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: number;
  connectedAt: number;
}

export interface HubSpotOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: number;
}

export interface CRMConnections {
  salesforce?: SalesforceOAuthToken;
  hubspot?: HubSpotOAuthToken;
}

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
  transcriptionProvider: TranscriptionProvider;
  // Hosted token support
  useHostedTokens: boolean;
  authApiBaseUrl: string;
  hostedAuthToken: string;
  // User profile
  userProfile?: {
    name?: string;
    email?: string;
    photo?: string;
    provider?: 'google' | 'outlook' | 'icloud';
  };
  // Calendar connections and optional OAuth config
  calendarConnections: CalendarConnections;
  googleCalendarClientId?: string;
  googleCalendarClientSecret?: string;
  outlookCalendarClientId?: string;
  outlookCalendarClientSecret?: string;
  icloudCalendarUsername?: string;
  icloudCalendarPassword?: string; // App-specific password
  // Calendar event mappings
  calendarEventMappings?: Record<string, CalendarEventMapping>;
  // Visible calendars per provider
  visibleCalendars?: {
    google?: string[];
    outlook?: string[];
    icloud?: string[];
  };
  // CRM Integration
  crmConnections?: CRMConnections;
  crmNotesBehavior?: CRMNotesBehavior;
  // CRM OAuth credentials
  crmOAuthSalesforceClientId?: string;
  crmOAuthSalesforceClientSecret?: string;
  crmOAuthHubSpotClientId?: string;
  crmOAuthHubSpotClientSecret?: string;
  // Custom meeting types for PrepView
  customMeetingTypes?: string[];
}

// Mapping between calendar events and notes/recordings
export interface CalendarEventMapping {
  calendarEventId: string;
  meetingId?: string;
  notesId?: string;
  linkedAt: number;
  provider: 'google' | 'outlook' | 'icloud';
}

// IPC payloads
export interface TranscriptUpdate {
  segment: TranscriptSegment;
  meetingId: string;
}

// Calendar
export interface CalendarAttendee {
  email: string;
  name?: string; // displayName from Google or name from Outlook
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  provider: 'google' | 'outlook' | 'icloud' | 'unknown';
  location?: string;
  attendees?: CalendarAttendee[];
  description?: string;
}

