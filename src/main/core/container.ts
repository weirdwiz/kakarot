import { MeetingRepository, CalloutRepository, SettingsRepository } from '../data/repositories';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { createLogger } from './logger';
import { CalendarService } from '../services/CalendarService';

const logger = createLogger('Container');

export interface AppContainer {
  meetingRepo: MeetingRepository;
  calloutRepo: CalloutRepository;
  settingsRepo: SettingsRepository;
  aiProvider: OpenAIProvider | null;
  calendarService: CalendarService;
}

let container: AppContainer | null = null;

/**
 * Initialize the dependency container
 * Must be called after database is initialized
 */
export function initializeContainer(): AppContainer {
  const meetingRepo = new MeetingRepository();
  const calloutRepo = new CalloutRepository();
  const settingsRepo = new SettingsRepository();
  const calendarService = new CalendarService();

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
    calendarService,
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

  container.aiProvider = config.apiKey ? new OpenAIProvider(config) : null;
  logger.info('AI provider refreshed', { configured: !!config.apiKey });
}
