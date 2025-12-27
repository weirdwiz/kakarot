// IPC channel constants for type-safe communication

export const IPC_CHANNELS = {
  // Recording controls
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_PAUSE: 'recording:pause',
  RECORDING_RESUME: 'recording:resume',
  RECORDING_STATE: 'recording:state',

  // Audio
  AUDIO_LEVELS: 'audio:levels',
  AUDIO_DATA: 'audio:data',
  AUDIO_GET_SOURCES: 'audio:getSources',

  // Transcription
  TRANSCRIPT_UPDATE: 'transcript:update',
  TRANSCRIPT_FINAL: 'transcript:final',

  // Meetings
  MEETINGS_LIST: 'meetings:list',
  MEETINGS_GET: 'meetings:get',
  MEETINGS_DELETE: 'meetings:delete',
  MEETINGS_SEARCH: 'meetings:search',

  // Callout
  CALLOUT_SHOW: 'callout:show',
  CALLOUT_DISMISS: 'callout:dismiss',
  CALLOUT_WINDOW_TOGGLE: 'callout:window:toggle',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Post-processing
  MEETING_SUMMARIZE: 'meeting:summarize',
  MEETING_EXPORT: 'meeting:export',

  // Knowledge base
  KNOWLEDGE_INDEX: 'knowledge:index',
  KNOWLEDGE_SEARCH: 'knowledge:search',

  // Calendar
  CALENDAR_CONNECT: 'calendar:connect',
  CALENDAR_DISCONNECT: 'calendar:disconnect',
  CALENDAR_LIST_TODAY: 'calendar:listToday',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
