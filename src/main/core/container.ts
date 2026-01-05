import { MeetingRepository, CalloutRepository, SettingsRepository, PeopleRepository } from '../data/repositories';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { createLogger } from './logger';
import { CalendarService } from '../services/CalendarService';
import { NoteGenerationService } from '../services/NoteGenerationService';
import { HubSpotService } from '../services/HubSpotService';
import { SalesforceService } from '../services/SalesforceService';
import { MeetingNotificationService } from '../services/MeetingNotificationService';

const logger = createLogger('Container');

export interface AppContainer {
  meetingRepo: MeetingRepository;
  calloutRepo: CalloutRepository;
  settingsRepo: SettingsRepository;
  peopleRepo: PeopleRepository;
  aiProvider: OpenAIProvider | null;
  calendarService: CalendarService;
  noteGenerationService: NoteGenerationService;
  hubSpotService: HubSpotService;
  salesforceService: SalesforceService;
  meetingNotificationService: MeetingNotificationService;
}

let container: AppContainer | null = null;


export function initializeContainer(): AppContainer {
  const meetingRepo = new MeetingRepository();
  const calloutRepo = new CalloutRepository();
  const settingsRepo = new SettingsRepository();
  const peopleRepo = new PeopleRepository();
  const calendarService = new CalendarService(settingsRepo);

  // Initialize default settings
  settingsRepo.initializeDefaults();

  // Create AI provider if API key is available
  let settings = settingsRepo.getSettings();

  // Sanitize: perma-remove Birthdays calendar from visible calendars if previously stored
  try {
    const BIRTHDAYS_ID = 'addressbook#contacts@group.v.calendar.google.com';
    const googleVisible = settings.visibleCalendars?.google || [];
    const hasBirthdays = googleVisible.some((id) => typeof id === 'string' && id.includes(BIRTHDAYS_ID));
    if (hasBirthdays) {
      const filtered = googleVisible.filter((id) => !id.includes(BIRTHDAYS_ID));
      const nextVisible = { ...(settings.visibleCalendars || {}), google: filtered };
      settingsRepo.updateSettings({ visibleCalendars: nextVisible });
      settings = settingsRepo.getSettings();
      logger.info('Sanitized visible calendars: removed Birthdays calendar');
    }
  } catch (err) {
    logger.warn('Failed to sanitize visible calendars', { error: (err as Error).message });
  }

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

  // Initialize note generation service
  const noteGenerationService = new NoteGenerationService();
  noteGenerationService.initialize(settings);

  // Initialize CRM services
  const hubSpotService = new HubSpotService();
  const salesforceService = new SalesforceService();

  // Initialize meeting notification service
  const meetingNotificationService = new MeetingNotificationService(calendarService);

  container = {
    meetingRepo,
    calloutRepo,
    settingsRepo,
    peopleRepo,
    aiProvider,
    calendarService,
    noteGenerationService,
    hubSpotService,
    salesforceService,
    meetingNotificationService,
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
