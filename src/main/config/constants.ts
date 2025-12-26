import type { AppSettings } from '../../shared/types';

// Default application settings
export const DEFAULT_SETTINGS: AppSettings = {
  assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY || '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  knowledgeBasePath: '',
  autoDetectQuestions: true,
  showFloatingCallout: true,
  transcriptionLanguage: 'en',
  transcriptionProvider: 'assemblyai',
};

// AI model identifiers
export const AI_MODELS = {
  GPT4_TURBO: 'gpt-4-turbo-preview',
  GPT4O: 'gpt-4o',
  EMBEDDING_SMALL: 'text-embedding-3-small',
  EMBEDDING_LARGE: 'text-embedding-3-large',
} as const;

// Question detection patterns
export const QUESTION_PATTERNS = [
  /\?$/,
  /^(what|where|when|why|how|who|which|can|could|would|should|is|are|do|does|did|have|has|will)/i,
  /^(tell me|explain|describe|clarify)/i,
  /^(do you know|can you tell|could you explain)/i,
];

// Knowledge service configuration
export const KNOWLEDGE_CONFIG = {
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  SUPPORTED_EXTENSIONS: ['.txt', '.md', '.markdown', '.json'],
  MAX_SEARCH_RESULTS: 5,
} as const;

// Callout service configuration
export const CALLOUT_CONFIG = {
  MAX_CONTEXT_SEGMENTS: 20,
  MAX_PAST_MEETINGS: 3,
  MAX_KNOWLEDGE_RESULTS: 3,
} as const;

// Audio configuration
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 48000,
  SILENCE_THRESHOLD: 10,
  PACKET_LOG_INTERVAL: 10,
} as const;

// Export configuration
export const EXPORT_CONFIG = {
  EXPORT_DIR: 'exports',
  DATA_DIR: 'data',
} as const;

/**
 * Check if text matches any question pattern
 */
export function matchesQuestionPattern(text: string): boolean {
  return QUESTION_PATTERNS.some((pattern) => pattern.test(text.trim()));
}
