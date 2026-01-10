import type { AppSettings } from '@shared/types';
export const DEFAULT_SETTINGS: AppSettings = {
  assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY || '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  knowledgeBasePath: '',
  autoDetectQuestions: true,
  showFloatingCallout: true,
  transcriptionLanguage: 'en',
  transcriptionProvider: 'assemblyai',
  useHostedTokens: false,
  authApiBaseUrl: process.env.AUTH_API_BASE_URL || '',
  hostedAuthToken: process.env.AUTH_API_TOKEN || '',
  calendarConnections: {},
};

// AI model identifiers
export const AI_MODELS = {
  GPT4O: 'gpt-4o',
  EMBEDDING_SMALL: 'text-embedding-3-small',
} as const;

// Question detection patterns
export const QUESTION_PATTERNS = [
  /\?$/,
  /^(what|where|when|why|how|who|which|can|could|would|should|is|are|do|does|did|have|has|will)/i,
  /^(tell me|explain|describe|clarify)/i,
  /^(do you know|can you tell|could you explain)/i,
];

// Callout service configuration
export const CALLOUT_CONFIG = {
  MAX_CONTEXT_SEGMENTS: 20,
  MAX_PAST_MEETINGS: 3,
  MAX_KNOWLEDGE_RESULTS: 3,
} as const;

// Audio configuration
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 48000,
  CHUNK_DURATION_MS: 256,
  CHANNELS: 1 as const,
  BIT_DEPTH: 16 as const,
} as const;

// Acoustic Echo Cancellation configuration (WebRTC AEC3)
export const AEC_CONFIG = {
  /** Enable AEC processing (will still auto-bypass if native module unavailable) */
  ENABLED: true,
  /** Number of audio channels (1 = mono) */
  NUM_CHANNELS: 1,
  /** Automatically bypass AEC when headphones are detected */
  HEADPHONE_BYPASS: true,
  /** Emit metrics every N frames */
  METRICS_INTERVAL_FRAMES: 100,
} as const;

// Export configuration
export const EXPORT_CONFIG = {
  EXPORT_DIR: 'exports',
  DATA_DIR: 'data',
} as const;

export function matchesQuestionPattern(text: string): boolean {
  return QUESTION_PATTERNS.some((pattern) => pattern.test(text.trim()));
}
