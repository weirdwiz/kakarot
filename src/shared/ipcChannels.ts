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
  MEETING_NOTES_GENERATING: 'meeting:notesGenerating',
  MEETING_NOTES_COMPLETE: 'meeting:notesComplete',

  // Knowledge base
  KNOWLEDGE_INDEX: 'knowledge:index',
  KNOWLEDGE_SEARCH: 'knowledge:search',

  // Calendar
  CALENDAR_CONNECT: 'calendar:connect',
  CALENDAR_DISCONNECT: 'calendar:disconnect',
  CALENDAR_LIST_TODAY: 'calendar:listToday',
<<<<<<< HEAD
  CALENDAR_CONNECT: 'calendar:connect',
  CALENDAR_DISCONNECT: 'calendar:disconnect',
=======
>>>>>>> 24b5726f2d857d558a8da9f0fa4c9fe860b76865
  CALENDAR_GET_UPCOMING: 'calendar:getUpcoming',
  CALENDAR_LINK_EVENT: 'calendar:linkEvent',
  CALENDAR_GET_EVENT_FOR_MEETING: 'calendar:getEventForMeeting',
  CALENDAR_LINK_NOTES: 'calendar:linkNotes',
<<<<<<< HEAD
  
  // Calendar OAuth
  CALENDAR_OAUTH_START: 'calendar:oauth:start',
  CALENDAR_OAUTH_DISCONNECT: 'calendar:oauth:disconnect',
  CALENDAR_OAUTH_STATUS: 'calendar:oauth:status',
  CALENDAR_CREDENTIALS_SAVE: 'calendar:credentials:save',
  CALENDAR_CREDENTIALS_GET: 'calendar:credentials:get',
=======
>>>>>>> 24b5726f2d857d558a8da9f0fa4c9fe860b76865
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
