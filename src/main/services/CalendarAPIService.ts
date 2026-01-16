import { createLogger } from '../core/logger';
import { CalendarEvent } from '../../shared/types';
import { CalendarTokens } from './CalendarAuthService';

const logger = createLogger('CalendarAPIService');

/**
 * Service for fetching calendar events from Google, Outlook, and iCloud
 */
export class CalendarAPIService {
  /**
   * Fetch events from Google Calendar
   */
  async fetchGoogleEvents(
    tokens: CalendarTokens,
    timeMin?: Date,
    timeMax?: Date
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams({
        timeMin: (timeMin || new Date()).toISOString(),
        timeMax: (timeMax || new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('Google Calendar API error', { error, status: response.status });
        return [];
      }

      const data = await response.json();

      const events: CalendarEvent[] = (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.summary || 'Untitled Event',
        start: new Date(item.start.dateTime || item.start.date),
        end: new Date(item.end.dateTime || item.end.date),
        provider: 'google' as const,
        location: item.location,
        attendees: item.attendees?.map((a: any) => a.email) || [],
        description: item.description,
      }));

      logger.info('Fetched Google Calendar events', { count: events.length });
      return events;
    } catch (error) {
      logger.error('Error fetching Google events', { error });
      return [];
    }
  }

  /**
   * Fetch events from Outlook/Microsoft Calendar via Graph API
   */
  async fetchOutlookEvents(
    tokens: CalendarTokens,
    timeMin?: Date,
    timeMax?: Date
  ): Promise<CalendarEvent[]> {
    try {
      const startDateTime = (timeMin || new Date()).toISOString();
      const endDateTime = (timeMax || new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString();

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime&$top=50`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('Outlook Calendar API error', { error, status: response.status });
        return [];
      }

      const data = await response.json();

      const events: CalendarEvent[] = (data.value || []).map((item: any) => ({
        id: item.id,
        title: item.subject || 'Untitled Event',
        start: new Date(item.start.dateTime + 'Z'), // Graph API returns datetime without Z
        end: new Date(item.end.dateTime + 'Z'),
        provider: 'outlook' as const,
        location: item.location?.displayName,
        attendees: item.attendees?.map((a: any) => a.emailAddress.address) || [],
        description: item.bodyPreview,
      }));

      logger.info('Fetched Outlook Calendar events', { count: events.length });
      return events;
    } catch (error) {
      logger.error('Error fetching Outlook events', { error });
      return [];
    }
  }

  /**
   * Fetch events from iCloud Calendar via CalDAV
   * Note: iCloud uses CalDAV protocol, which is more complex than REST APIs
   * This is a simplified implementation
   */
  async fetchICloudEvents(
    username: string,
    _appPassword: string,
    _timeMin?: Date,
    _timeMax?: Date
  ): Promise<CalendarEvent[]> {
    try {
      // For now, return empty array
      // Full CalDAV implementation requires XML parsing and PROPFIND requests
      logger.warn('iCloud CalDAV integration not fully implemented', { username });
      
      // TODO: Implement full CalDAV support
      // - Discover calendar collections via PROPFIND
      // - Query events via REPORT with calendar-query
      // - Parse iCalendar (ICS) format responses
      
      return [];
    } catch (error) {
      logger.error('Error fetching iCloud events', { error });
      return [];
    }
  }

  /**
   * Refresh access token if expired
   */
  private async refreshAccessTokenIfNeeded(
    provider: 'google' | 'outlook',
    tokens: CalendarTokens,
    _refreshCallback: (newTokens: CalendarTokens) => Promise<void>
  ): Promise<CalendarTokens> {
    // Check if token is expired (with 5 minute buffer)
    if (Date.now() >= tokens.expiresAt - (5 * 60 * 1000)) {
      logger.info('Access token expired, refreshing', { provider });
      
      // Refresh logic would be handled by CalendarAuthService
      // This is just a placeholder for the flow
      return tokens;
    }

    return tokens;
  }
}
