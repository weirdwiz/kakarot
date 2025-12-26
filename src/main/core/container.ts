import { MeetingRepository, CalloutRepository, SettingsRepository } from '../data/repositories';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { NoteGenerationService } from '../services/NoteGenerationService';
import { createLogger } from './logger';

const logger = createLogger('Container');

export interface AppContainer {
  meetingRepo: MeetingRepository;
  calloutRepo: CalloutRepository;
  settingsRepo: SettingsRepository;
  aiProvider: OpenAIProvider | null;
  noteService: NoteGenerationService;
}

let container: AppContainer | null = null;

export function initializeContainer(): AppContainer {
  const meetingRepo = new MeetingRepository();
  const calloutRepo = new CalloutRepository();
  const settingsRepo = new SettingsRepository();
  const noteService = new NoteGenerationService();

  // Initialize default settings
  settingsRepo.initializeDefaults();

  // Create AI provider if API key is available
  const settings = settingsRepo.getSettings();
  const aiProvider = settings.openAiApiKey
    ? new OpenAIProvider({
        apiKey: settings.openAiApiKey,
        baseURL: settings.openAiBaseUrl || undefined,
        defaultModel: settings.openAiModel || undefined,
      })
    : null;

  if (!aiProvider) {
    logger.warn('OpenAI API key not configured - AI features disabled');
  }

  // Initialize note service with settings
  noteService.initialize(settings);

  container = {
    meetingRepo,
    calloutRepo,
    settingsRepo,
    aiProvider,
    noteService,
  };

  logger.info('Container initialized');
  return container;
}

export function getContainer(): AppContainer {
  if (!container) {
    throw new Error('Container not initialized. Call initializeContainer() first.');
  }
  return container;
}

export function refreshAIProvider(settings: {
  openAiApiKey: string;
  openAiBaseUrl?: string;
  openAiModel?: string;
}): void {
  if (!container) {
    throw new Error('Container not initialized');
  }

  container.aiProvider = settings.openAiApiKey
    ? new OpenAIProvider({
        apiKey: settings.openAiApiKey,
        baseURL: settings.openAiBaseUrl || undefined,
        defaultModel: settings.openAiModel || undefined,
      })
    : null;
  logger.info('AI provider refreshed', { configured: !!settings.openAiApiKey });
}
