import { createLogger } from '../core/logger';
import type { CalendarEvent } from '../../shared/types';
import { CalendarAPIService } from './CalendarAPIService';
import { TokenStorageService } from './TokenStorageService';
import { CalendarAuthService } from './CalendarAuthService';

const logger = createLogger('CalendarService');

export class CalendarService {
  private apiService: CalendarAPIService;
  private tokenStorage: TokenStorageService | null = null;
  private authService: CalendarAuthService | null = null;

  constructor() {
    this.apiService = new CalendarAPIService();
  }

  /**
   * Set dependencies (called by container after initialization)
   */
  setDependencies(tokenStorage: TokenStorageService, authService: CalendarAuthService) {
    this.tokenStorage = tokenStorage;
    this.authService = authService;
  }

  async listToday(): Promise<CalendarEvent[]> {
    if (!this.tokenStorage || !this.authService) {
      logger.warn('Token storage not initialized, returning mock data');
      return this.getMockEvents();
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const allEvents: CalendarEvent[] = [];

    // Fetch from Google Calendar
    try {
      const googleData = await this.tokenStorage.getTokens('google');
      if (googleData) {
        let tokens = googleData.tokens;

        // Refresh token if expired
        if (this.tokenStorage.isTokenExpired(tokens) && tokens.refreshToken) {
          logger.info('Refreshing Google access token');
          const newTokens = await this.authService.refreshToken(
            'google',
            tokens.refreshToken,
            googleData.clientId,
            googleData.clientSecret || ''
          );

          if (newTokens) {
            tokens = newTokens;
            await this.tokenStorage.storeTokens(
              'google',
              newTokens,
              googleData.clientId,
              googleData.clientSecret
            );
          }
        }

        const events = await this.apiService.fetchGoogleEvents(tokens, startOfDay, endOfDay);
        allEvents.push(...events);
      }
    } catch (error) {
      logger.error('Error fetching Google events', { error });
    }

    // Fetch from Outlook Calendar
    try {
      const outlookData = await this.tokenStorage.getTokens('outlook');
      if (outlookData) {
        let tokens = outlookData.tokens;

        // Refresh token if expired
        if (this.tokenStorage.isTokenExpired(tokens) && tokens.refreshToken) {
          logger.info('Refreshing Outlook access token');
          const newTokens = await this.authService.refreshToken(
            'outlook',
            tokens.refreshToken,
            outlookData.clientId,
            outlookData.clientSecret || ''
          );

          if (newTokens) {
            tokens = newTokens;
            await this.tokenStorage.storeTokens(
              'outlook',
              newTokens,
              outlookData.clientId,
              outlookData.clientSecret
            );
          }
        }

        const events = await this.apiService.fetchOutlookEvents(tokens, startOfDay, endOfDay);
        allEvents.push(...events);
      }
    } catch (error) {
      logger.error('Error fetching Outlook events', { error });
    }

    // Fetch from iCloud Calendar
    try {
      const icloudData = await this.tokenStorage.getTokens('icloud');
      if (icloudData && icloudData.userEmail) {
        // iCloud uses CalDAV, not OAuth
        // For now, this is a placeholder
        logger.info('iCloud calendar integration not fully implemented');
        // const events = await this.apiService.fetchICloudEvents(
        //   icloudData.userEmail,
        //   icloudData.tokens.accessToken,
        //   startOfDay,
        //   endOfDay
        // );
        // allEvents.push(...events);
      }
    } catch (error) {
      logger.error('Error fetching iCloud events', { error });
    }

    // Sort by start time
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    logger.info('Fetched calendar events', { count: allEvents.length });

    // Return mock events if no real events found (for backwards compatibility)
    return allEvents.length > 0 ? allEvents : this.getMockEvents();
  }

  private getMockEvents(): CalendarEvent[] {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const sample: CalendarEvent[] = [
      {
        id: 'evt-1',
        title: 'Weekly Sprint Planning',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 45),
        provider: 'unknown',
        location: 'Zoom',
        attendees: ['Team'],
      },
      {
        id: 'evt-2',
        title: 'Enter Weekly Forecast',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 21, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 22, 0),
        provider: 'unknown',
      },
    ];

    logger.info('Returning mock calendar events', { count: sample.length });
    return sample.filter((e) => e.start >= startOfDay && e.start.getDate() === now.getDate());
  }
}

