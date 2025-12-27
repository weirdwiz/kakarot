import { createLogger } from '../core/logger';
import type { CalendarEvent, CalendarListResult } from '@shared/types';
import { CalendarAPIService } from './CalendarAPIService';
import { TokenStorageService } from './TokenStorageService';
import { CalendarAuthService } from './CalendarAuthService';

const logger = createLogger('CalendarService');

export class CalendarService {
  private apiService = new CalendarAPIService();
  private tokenStorage: TokenStorageService;
  private authService: CalendarAuthService;

  constructor(tokenStorage: TokenStorageService, authService: CalendarAuthService) {
    this.tokenStorage = tokenStorage;
    this.authService = authService;
  }

  async listToday(): Promise<CalendarListResult> {

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const allEvents: CalendarEvent[] = [];
    const errors: string[] = [];

    const googleResult = await this.fetchFromGoogle(startOfDay, endOfDay);
    allEvents.push(...googleResult.events);
    if (googleResult.error) errors.push(googleResult.error);

    const outlookResult = await this.fetchFromOutlook(startOfDay, endOfDay);
    allEvents.push(...outlookResult.events);
    if (outlookResult.error) errors.push(outlookResult.error);

    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    logger.info('Fetched calendar events', { count: allEvents.length, errorCount: errors.length });
    return { events: allEvents, errors };
  }

  private async fetchFromGoogle(
    startOfDay: Date,
    endOfDay: Date
  ): Promise<{ events: CalendarEvent[]; error?: string }> {
    try {
      const data = await this.tokenStorage.getTokens('google');
      if (!data) return { events: [] };

      let { tokens } = data;

      // Refresh if expired
      if (this.tokenStorage.isTokenExpired(tokens) && tokens.refreshToken) {
        logger.info('Refreshing Google token');
        const refreshed = await this.authService.refreshToken(
          'google',
          tokens.refreshToken,
          data.clientId,
          data.clientSecret || ''
        );

        if (!refreshed) {
          return { events: [], error: 'Google Calendar session expired. Please reconnect.' };
        }

        tokens = refreshed;
        await this.tokenStorage.storeTokens('google', tokens, data.clientId, data.clientSecret);
      }

      return await this.apiService.fetchGoogleEvents(tokens, startOfDay, endOfDay);
    } catch (err) {
      logger.error('Google calendar fetch failed', { err });
      return { events: [], error: 'Failed to fetch Google Calendar events.' };
    }
  }

  private async fetchFromOutlook(
    startOfDay: Date,
    endOfDay: Date
  ): Promise<{ events: CalendarEvent[]; error?: string }> {
    try {
      const data = await this.tokenStorage.getTokens('outlook');
      if (!data) return { events: [] };

      let { tokens } = data;

      // Refresh if expired
      if (this.tokenStorage.isTokenExpired(tokens) && tokens.refreshToken) {
        logger.info('Refreshing Outlook token');
        const refreshed = await this.authService.refreshToken(
          'outlook',
          tokens.refreshToken,
          data.clientId,
          data.clientSecret || ''
        );

        if (!refreshed) {
          return { events: [], error: 'Outlook Calendar session expired. Please reconnect.' };
        }

        tokens = refreshed;
        await this.tokenStorage.storeTokens('outlook', tokens, data.clientId, data.clientSecret);
      }

      return await this.apiService.fetchOutlookEvents(tokens, startOfDay, endOfDay);
    } catch (err) {
      logger.error('Outlook calendar fetch failed', { err });
      return { events: [], error: 'Failed to fetch Outlook Calendar events.' };
    }
  }
}

