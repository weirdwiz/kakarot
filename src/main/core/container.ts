import { MeetingRepository, CalloutRepository, SettingsRepository } from '../data/repositories';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { createLogger } from './logger';
import { CalendarService } from '../services/CalendarService';
import { CalloutService } from '../services/CalloutService';
import { NoteGenerationService } from '../services/NoteGenerationService';

const logger = createLogger('Container');

export interface AppContainer {
  meetingRepo: MeetingRepository;
  calloutRepo: CalloutRepository;
  settingsRepo: SettingsRepository;
  aiProvider: OpenAIProvider | null;
  calendarService: CalendarService;
  calloutService: CalloutService;
  noteGenerationService: NoteGenerationService;
}

let container: AppContainer | null = null;


export function initializeContainer(): AppContainer {
  const meetingRepo = new MeetingRepository();
  const calloutRepo = new CalloutRepository();
  const settingsRepo = new SettingsRepository();
  const calendarService = new CalendarService(settingsRepo);

  // Initialize default settings
  settingsRepo.initializeDefaults();

  // Create AI provider if API key is available
  let settings = settingsRepo.getSettings();

  // Force OpenAI API base URL if still pointing to RouteLLM
  if (settings.openAiBaseUrl && /routellm\.abacus\.ai/i.test(settings.openAiBaseUrl)) {
    settingsRepo.updateSettings({
      openAiBaseUrl: 'https://api.openai.com/v1',
      openAiModel: settings.openAiModel || 'gpt-4o',
    });
    settings = settingsRepo.getSettings();
  }
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

  // Initialize note generation service with aiProvider getter (avoids circular dependency)
  const noteGenerationService = new NoteGenerationService(() => container?.aiProvider ?? null);

  // Initialize callout service
  const calloutService = new CalloutService();

  container = {
    meetingRepo,
    calloutRepo,
    settingsRepo,
    aiProvider,
    calendarService,
    calloutService,
    noteGenerationService,
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
