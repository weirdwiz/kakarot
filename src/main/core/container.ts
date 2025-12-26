import { MeetingRepository, CalloutRepository, SettingsRepository } from '../data/repositories';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { createLogger } from './logger';

const logger = createLogger('Container');

export interface AppContainer {
  meetingRepo: MeetingRepository;
  calloutRepo: CalloutRepository;
  settingsRepo: SettingsRepository;
  aiProvider: OpenAIProvider | null;
}

let container: AppContainer | null = null;

export function initializeContainer(): AppContainer {
  const meetingRepo = new MeetingRepository();
  const calloutRepo = new CalloutRepository();
  const settingsRepo = new SettingsRepository();

  // Initialize default settings
  settingsRepo.initializeDefaults();

  // Create AI provider if API key is available
  const settings = settingsRepo.getSettings();
  const aiProvider = settings.openAiApiKey ? new OpenAIProvider(settings.openAiApiKey) : null;

  if (!aiProvider) {
    logger.warn('OpenAI API key not configured - AI features disabled');
  }

  container = {
    meetingRepo,
    calloutRepo,
    settingsRepo,
    aiProvider,
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

export function refreshAIProvider(apiKey: string): void {
  if (!container) {
    throw new Error('Container not initialized');
  }

  container.aiProvider = apiKey ? new OpenAIProvider(apiKey) : null;
  logger.info('AI provider refreshed', { configured: !!apiKey });
}
