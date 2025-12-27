import { createLogger } from '../core/logger';
import type {
  CalendarTokens,
  CalendarFetchResult,
  GoogleCalendarResponse,
  GoogleCalendarItem,
  OutlookCalendarResponse,
  OutlookCalendarItem,
} from '@shared/types';

const logger = createLogger('CalendarAPI');
const DAY_MS = 24 * 60 * 60 * 1000;

function httpError(provider: string, status: number): string {
  if (status === 401) return `${provider} access expired. Please reconnect.`;
  if (status === 403) return `${provider} access denied. Check permissions.`;
  return `${provider} error (${status})`;
}

export class CalendarAPIService {
  async fetchGoogleEvents(
    tokens: CalendarTokens,
    timeMin?: Date,
    timeMax?: Date
  ): Promise<CalendarFetchResult> {
    const start = timeMin ?? new Date();
    const end = timeMax ?? new Date(Date.now() + DAY_MS);

    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    try {
      const resp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      );

      if (!resp.ok) {
        logger.error('Google API error', { status: resp.status });
        return { events: [], error: httpError('Google Calendar', resp.status) };
      }

      const data: GoogleCalendarResponse = await resp.json();
      const events = (data.items ?? []).map((e: GoogleCalendarItem) => ({
        id: e.id,
        title: e.summary || 'Untitled',
        start: new Date(e.start.dateTime || e.start.date || ''),
        end: new Date(e.end.dateTime || e.end.date || ''),
        provider: 'google' as const,
        location: e.location,
        attendees: e.attendees?.map((a) => a.email) ?? [],
        description: e.description,
      }));

      logger.info('Fetched Google events', { count: events.length });
      return { events };
    } catch (err) {
      logger.error('Google fetch failed', { err });
      return { events: [], error: 'Cannot reach Google Calendar.' };
    }
  }

  async fetchOutlookEvents(
    tokens: CalendarTokens,
    timeMin?: Date,
    timeMax?: Date
  ): Promise<CalendarFetchResult> {
    const start = (timeMin ?? new Date()).toISOString();
    const end = (timeMax ?? new Date(Date.now() + DAY_MS)).toISOString();

    try {
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${start}&endDateTime=${end}&$orderby=start/dateTime&$top=50`,
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      );

      if (!resp.ok) {
        logger.error('Outlook API error', { status: resp.status });
        return { events: [], error: httpError('Outlook Calendar', resp.status) };
      }

      const data: OutlookCalendarResponse = await resp.json();
      const events = (data.value ?? []).map((e: OutlookCalendarItem) => ({
        id: e.id,
        title: e.subject || 'Untitled',
        start: new Date(e.start.dateTime + 'Z'),
        end: new Date(e.end.dateTime + 'Z'),
        provider: 'outlook' as const,
        location: e.location?.displayName,
        attendees: e.attendees?.map((a) => a.emailAddress.address) ?? [],
        description: e.bodyPreview,
      }));

      logger.info('Fetched Outlook events', { count: events.length });
      return { events };
    } catch (err) {
      logger.error('Outlook fetch failed', { err });
      return { events: [], error: 'Cannot reach Outlook Calendar.' };
    }
  }

  async fetchICloudEvents(
    _username: string,
    _appPassword: string,
    _timeMin?: Date,
    _timeMax?: Date
  ): Promise<CalendarFetchResult> {
    // CalDAV needs PROPFIND/REPORT with XML - not implemented
    logger.warn('iCloud CalDAV not implemented');
    return { events: [], error: 'iCloud coming soon.' };
  }
}
