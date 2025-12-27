import { MeetingRepository, CalloutRepository, SettingsRepository } from '../data/repositories';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { createLogger } from './logger';
import { CalendarService } from '../services/CalendarService';
import { CalendarAuthService } from '../services/CalendarAuthService';
import { TokenStorageService } from '../services/TokenStorageService';

const logger = createLogger('Container');

export interface AppContainer {
  meetingRepo: MeetingRepository;
  calloutRepo: CalloutRepository;
  settingsRepo: SettingsRepository;
  aiProvider: OpenAIProvider | null;
  noteService: NoteGenerationService;
  calendarService: CalendarService;
  calendarAuthService: CalendarAuthService;
  tokenStorageService: TokenStorageService;
}

let container: AppContainer | null = null;


export function initializeContainer(): AppContainer {
  const meetingRepo = new MeetingRepository();
  const calloutRepo = new CalloutRepository();
  const settingsRepo = new SettingsRepository();
  const noteService = new NoteGenerationService();
  const calendarAuthService = new CalendarAuthService();
  const tokenStorageService = new TokenStorageService(settingsRepo);
  const calendarService = new CalendarService(tokenStorageService, calendarAuthService);

  // Initialize default settings
  settingsRepo.initializeDefaults();

  // Create AI provider if API key is available
  const settings = settingsRepo.getSettings();
  const aiProvider = settings.openAiApiKey ? new OpenAIProvider({ apiKey: settings.openAiApiKey }) : null;

  if (!aiProvider) {
    logger.warn('OpenAI API key not configured - AI features disabled');
  }

  container = {
    meetingRepo,
    calloutRepo,
    settingsRepo,
    aiProvider,
    noteService,
    calendarService,
    calendarAuthService,
    tokenStorageService,
  };

  logger.info('Container initialized');
  return container;
}

/**
 * Get the container instance
 * Throws if container hasn't been initialized
 */
export function getContainer(): AppContainer {
  if (!container) {
    throw new Error('Container not initialized. Call initializeContainer() first.');
  }
  return container;
}

/**
 * Reinitialize the AI provider with new settings
 * Called when settings are updated
 */
export function refreshAIProvider(config: { apiKey: string; baseURL?: string; defaultModel?: string }): void {
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

  // Also refresh the noteService's AI provider
  container.noteService.initialize({
    openAiApiKey: settings.openAiApiKey,
    openAiBaseUrl: settings.openAiBaseUrl || '',
    openAiModel: settings.openAiModel || '',
  } as import('@shared/types').AppSettings);

  logger.info('AI provider refreshed', { configured: !!settings.openAiApiKey });
}
