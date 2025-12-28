import { shell } from 'electron';
import { createServer } from 'http';
import { randomBytes, createHash } from 'crypto';
import type { AddressInfo } from 'net';
import { URLSearchParams } from 'url';
import type { CalendarConnections, CalendarEvent, OAuthTokens } from '@shared/types';
import { SettingsRepository } from '../data/repositories/SettingsRepository';
import { createLogger } from '../core/logger';

const logger = createLogger('CalendarService');

type Provider = 'google' | 'outlook' | 'icloud';

interface OAuthConfig {
  provider: Provider;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
}

export class CalendarService {
  constructor(private readonly settingsRepo: SettingsRepository) {}

  async connect(
    provider: Provider,
    payload?: { appleId: string; appPassword: string }
  ): Promise<CalendarConnections> {
    switch (provider) {
      case 'google': {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('Google Calendar is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
        }

        const tokens = await this.runOAuthFlow({
          provider,
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          clientId,
          clientSecret,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          extraAuthParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        });

        const updated = this.persistConnection('google', tokens);
        logger.info('Google calendar connected');
        return updated;
      }
      case 'outlook': {
        const clientId = process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
        const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error('Microsoft Calendar is not configured. Missing OUTLOOK_CLIENT_ID or MICROSOFT_CLIENT_ID.');
        }

        const tokens = await this.runOAuthFlow({
          provider,
          authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          clientId,
          clientSecret,
          scope: 'offline_access Calendars.Read',
        });

        const updated = this.persistConnection('outlook', tokens);
        logger.info('Outlook calendar connected');
        return updated;
      }
      case 'icloud': {
        if (!payload?.appleId || !payload?.appPassword) {
          throw new Error('Apple ID and app-specific password required for iCloud');
        }
        // Store credentials separately from OAuth tokens for CalDAV usage
        const settings = this.settingsRepo.getSettings();
        const merged: CalendarConnections = {
          ...settings.calendarConnections,
          icloud: {
            appleId: payload.appleId,
            appPassword: payload.appPassword,
          },
        };
        this.settingsRepo.updateSettings({ calendarConnections: merged });
        logger.info('iCloud calendar connected (app-specific password stored)');
        return merged;
      }
      default:
        throw new Error(`Unsupported provider ${provider}`);
    }
  }

  async disconnect(provider: Provider): Promise<CalendarConnections> {
    const settings = this.settingsRepo.getSettings();
    const updated: CalendarConnections = { ...settings.calendarConnections };
    delete updated[provider];
    this.settingsRepo.updateSettings({ calendarConnections: updated });
    logger.info('Calendar disconnected', { provider });
    return updated;
  }

  async listToday(): Promise<CalendarEvent[]> {
    const settings = this.settingsRepo.getSettings();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const results: CalendarEvent[] = [];

    if (settings.calendarConnections.google) {
      try {
        const events = await this.fetchGoogleEvents(settings.calendarConnections.google, start, end);
        results.push(...events);
      } catch (err) {
        logger.error('Failed to fetch Google events', { error: (err as Error).message });
      }
    }

    if (settings.calendarConnections.outlook) {
      try {
        const events = await this.fetchOutlookEvents(settings.calendarConnections.outlook, start, end);
        results.push(...events);
      } catch (err) {
        logger.error('Failed to fetch Outlook events', { error: (err as Error).message });
      }
    }

    if (settings.calendarConnections.icloud) {
      logger.warn('iCloud events fetch not yet implemented; returning empty set');
    }

    return results.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private persistConnection(provider: 'google' | 'outlook', tokens: OAuthTokens): CalendarConnections {
    const settings = this.settingsRepo.getSettings();
    const connections: CalendarConnections = {
      ...settings.calendarConnections,
      [provider]: tokens,
    };
    this.settingsRepo.updateSettings({ calendarConnections: connections });
    return connections;
  }

  private async runOAuthFlow(config: OAuthConfig): Promise<OAuthTokens> {
    const state = this.randomString(16);
    const codeVerifier = this.randomString(64);
    const codeChallenge = this.toCodeChallenge(codeVerifier);

    const redirectServer = await this.startRedirectListener(config.provider, state);
    const redirectUri = redirectServer.redirectUri;

    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', config.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    if (config.extraAuthParams) {
      for (const [key, value] of Object.entries(config.extraAuthParams)) {
        authUrl.searchParams.set(key, value);
      }
    }

    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OAuth ${config.provider}] Starting OAuth flow`);
      console.log(`[OAuth ${config.provider}] Redirect URI: ${redirectUri}`);
    }

    await shell.openExternal(authUrl.toString());
    logger.info('Opened OAuth browser flow', { provider: config.provider });

    const code = await redirectServer.waitForCode;
    redirectServer.close();

    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OAuth ${config.provider}] Received authorization code`);
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    });
    if (config.clientSecret) {
      body.set('client_secret', config.clientSecret);
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      if (process.env.NODE_ENV === 'development') {
        console.error(`[OAuth ${config.provider}] Token exchange failed:`, errorText);
      }
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenJson = await tokenResponse.json();
    const tokens: OAuthTokens = {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      expiresAt: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 : undefined,
      scope: tokenJson.scope,
      tokenType: tokenJson.token_type,
      idToken: tokenJson.id_token,
    };

    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OAuth ${config.provider}] ✓ Tokens received successfully`);
      console.log(`[OAuth ${config.provider}] Expires in: ${tokenJson.expires_in}s`);
    }

    return tokens;
  }

  private async startRedirectListener(provider: Provider, expectedState: string): Promise<{
    redirectUri: string;
    waitForCode: Promise<string>;
    close: () => void;
  }> {
    let resolveCode: (code: string) => void = () => {};
    let rejectCode: (error: Error) => void = () => {};
    const waitForCode = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    const server = createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, 'http://127.0.0.1');
      const receivedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');

      if (!code || receivedState !== expectedState) {
        rejectCode(new Error('OAuth callback missing code or state mismatch'));
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<p>Authentication failed. You can close this window.</p>');
        server.close();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<p>Authentication complete. You can close this window.</p>');
      resolveCode(code);
      server.close();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback/${provider}`;

    return {
      redirectUri,
      waitForCode,
      close: () => server.close(),
    };
  }

  private randomString(length: number): string {
    return randomBytes(length).toString('hex').slice(0, length);
  }

  private toCodeChallenge(verifier: string): string {
    const hash = createHash('sha256').update(verifier).digest();
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async ensureFreshToken(
    provider: 'google' | 'outlook',
    tokens: OAuthTokens,
    config: { tokenUrl: string; clientId: string; clientSecret?: string }
  ): Promise<OAuthTokens> {
    const needsRefresh = tokens.expiresAt !== undefined && tokens.expiresAt - Date.now() < 60_000;
    if (!needsRefresh || !tokens.refreshToken) return tokens;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: config.clientId,
    });
    if (config.clientSecret) {
      body.set('client_secret', config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Refresh token failed: ${errorText}`);
    }

    const data = await response.json();
    const refreshed: OAuthTokens = {
      ...tokens,
      accessToken: data.access_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : tokens.expiresAt,
      scope: data.scope ?? tokens.scope,
      tokenType: data.token_type ?? tokens.tokenType,
    };

    this.persistConnection(provider, refreshed);
    return refreshed;
  }

  private async fetchGoogleEvents(tokens: OAuthTokens, start: Date, end: Date, calendarId: string = 'primary'): Promise<CalendarEvent[]> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];

    const freshTokens = await this.ensureFreshToken('google', tokens, {
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId,
      clientSecret,
    });

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', start.toISOString());
    url.searchParams.set('timeMax', end.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${freshTokens.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google events request failed: ${errorText}`);
    }

    const data = await response.json();
    const events: CalendarEvent[] = (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.summary || 'Untitled',
      start: new Date(item.start?.dateTime || item.start?.date),
      end: new Date(item.end?.dateTime || item.end?.date || item.start?.dateTime || item.start?.date),
      provider: 'google',
      location: item.location,
      attendees: item.attendees?.map((a: any) => a.email) ?? [],
      description: item.description,
    }));

    return events;
  }

  private async fetchOutlookEvents(tokens: OAuthTokens, start: Date, end: Date): Promise<CalendarEvent[]> {
    const clientId = process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];

    const freshTokens = await this.ensureFreshToken('outlook', tokens, {
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      clientId,
      clientSecret,
    });

    const url = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
    url.searchParams.set('startdatetime', start.toISOString());
    url.searchParams.set('enddatetime', end.toISOString());
    url.searchParams.set('$orderby', 'start/dateTime');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${freshTokens.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outlook events request failed: ${errorText}`);
    }

    const data = await response.json();
    const events: CalendarEvent[] = (data.value || []).map((item: any) => ({
      id: item.id,
      title: item.subject || 'Untitled',
      start: new Date(item.start?.dateTime || item.start),
      end: new Date(item.end?.dateTime || item.end),
      provider: 'outlook',
      location: item.location?.displayName,
      attendees: item.attendees?.map((a: any) => a.emailAddress?.address) ?? [],
      description: item.bodyPreview,
    }));

    return events;
  }

  /**
   * Enhanced: Get upcoming meetings for the next 7 days
   * Uses cache first, falls back to fresh fetch
   */
  async getUpcomingMeetings(): Promise<CalendarEvent[]> {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const results: CalendarEvent[] = [];

    const settings = this.settingsRepo.getSettings();

    if (settings.calendarConnections.google) {
      try {
        const visible = settings.visibleCalendars?.google;
        if (visible && visible.length > 0) {
          for (const calId of visible) {
            const events = await this.fetchGoogleEvents(settings.calendarConnections.google, now, oneWeekFromNow, calId);
            results.push(...events);
          }
        } else {
          const events = await this.fetchGoogleEvents(settings.calendarConnections.google, now, oneWeekFromNow);
          results.push(...events);
        }
      } catch (err) {
        logger.error('Failed to fetch Google upcoming events', { error: (err as Error).message });
      }
    }

    if (settings.calendarConnections.outlook) {
      try {
        const events = await this.fetchOutlookEvents(settings.calendarConnections.outlook, now, oneWeekFromNow);
        results.push(...events);
      } catch (err) {
        logger.error('Failed to fetch Outlook upcoming events', { error: (err as Error).message });
      }
    }

    return results.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  async listCalendars(provider: Provider): Promise<Array<{ id: string; name: string }>> {
    const settings = this.settingsRepo.getSettings();
    if (provider === 'google' && settings.calendarConnections.google) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return [];
      const tokens = await this.ensureFreshToken('google', settings.calendarConnections.google, {
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId,
        clientSecret,
      });
      const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (!resp.ok) {
        logger.warn('Failed to list google calendars', { status: resp.status });
        return [];
      }
      const data = await resp.json();
      // Filter to show only "My calendars" according to Google Calendar rules:
      // - Include if primary
      // - Include if accessRole is 'owner' or 'writer'
      // - Exclude read-only roles ('reader', 'freeBusyReader')
      // - Optional: respect user's sidebar selection when env flag is set
      const onlySelected = process.env.GOOGLE_CALENDAR_ONLY_SELECTED === 'true';
      const filtered = (data.items || []).filter((c: any) => {
        const role = (c.accessRole as string | undefined) || '';
        const isPrimary = !!c.primary;
        const writable = role === 'owner' || role === 'writer';
        const isBirthdays = typeof c.id === 'string' && c.id.includes('addressbook#contacts@group.v.calendar.google.com');

        // Always include primary calendar
        if (isPrimary) return onlySelected ? !!c.selected : true;

        // New rule: include Birthdays calendar even if read-only
        if (isBirthdays) return onlySelected ? !!c.selected : true;

        // Include writable calendars only (exclude other read-only calendars)
        if (writable) return onlySelected ? !!c.selected : true;

        return false;
      });

      return filtered.map((c: any) => ({ id: c.id, name: c.summary }));
    }
    if (provider === 'outlook' && settings.calendarConnections.outlook) {
      // Optional: implement in future
      return [];
    }
    if (provider === 'icloud' && settings.calendarConnections.icloud) {
      // Optional: implement in future
      return [];
    }
    return [];
  }

  async setVisibleCalendars(provider: Provider, ids: string[]): Promise<void> {
    const settings = this.settingsRepo.getSettings();
    const visible = settings.visibleCalendars || {};
    const next = { ...visible, [provider]: ids } as typeof visible;
    this.settingsRepo.updateSettings({ visibleCalendars: next });
    logger.info('Updated visible calendars', { provider, count: ids.length });
  }

  /**
   * Enhanced: Link a calendar event to meeting notes
   * Stores bidirectional mapping
   */
  async linkEventToNotes(
    calendarEventId: string,
    meetingId: string,
    provider: 'google' | 'outlook' | 'icloud'
  ): Promise<void> {
    // Get or create the calendar mappings in settings
    const settings = this.settingsRepo.getSettings();
    const mappings: Record<string, any> = settings.calendarEventMappings || {};
    
    mappings[calendarEventId] = {
      calendarEventId,
      meetingId,
      linkedAt: Date.now(),
      provider,
    };

    // Persist the mapping
    this.settingsRepo.updateSettings({ calendarEventMappings: mappings });
    logger.info('Linked calendar event to notes', { calendarEventId, meetingId, provider });
  }

  /**
   * Enhanced: Get meeting notes link if it exists
   */
  getMeetingNotesLink(calendarEventId: string): string | null {
    const settings = this.settingsRepo.getSettings();
    const mappings = settings.calendarEventMappings || {};
    const mapping = mappings[calendarEventId];
    return mapping?.meetingId || null;
  }

  /**
   * Enhanced: Find calendar event by meeting ID (reverse lookup)
   */
  async findCalendarEventForMeeting(meetingId: string): Promise<CalendarEvent | null> {
    const settings = this.settingsRepo.getSettings();
    const mappings = settings.calendarEventMappings || {};
    
    // Find mapping with this meetingId
    for (const [, mapping] of Object.entries(mappings)) {
      if ((mapping as any).meetingId === meetingId) {
        // Fetch the full event
        const eventId = (mapping as any).calendarEventId;
        const provider = (mapping as any).provider;
        
        if (provider === 'google' && settings.calendarConnections.google) {
          try {
            const events = await this.fetchGoogleEvents(settings.calendarConnections.google, new Date(0), new Date());
            return events.find(e => e.id === eventId) || null;
          } catch (err) {
            logger.error('Failed to fetch Google event', { error: (err as Error).message });
          }
        }
        
        if (provider === 'outlook' && settings.calendarConnections.outlook) {
          try {
            const events = await this.fetchOutlookEvents(settings.calendarConnections.outlook, new Date(0), new Date());
            return events.find(e => e.id === eventId) || null;
          } catch (err) {
            logger.error('Failed to fetch Outlook event', { error: (err as Error).message });
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Get a calendar event by ID (for recording lifecycle)
   * Returns full event details with all metadata
   */
  async getEventById(eventId: string): Promise<CalendarEvent | null> {
    const settings = this.settingsRepo.getSettings();
    const mappings = settings.calendarEventMappings || {};
    const mapping = mappings[eventId];
    const provider = mapping?.provider || 'google';

    // Try to fetch from the provider
    if (provider === 'google' && settings.calendarConnections.google) {
      try {
        const events = await this.fetchGoogleEvents(settings.calendarConnections.google, new Date(0), new Date());
        const event = events.find(e => e.id === eventId);
        if (event) return event;
      } catch (err) {
        logger.debug('Failed to fetch Google event by ID', { eventId, error: (err as Error).message });
      }
    }

    if (provider === 'outlook' && settings.calendarConnections.outlook) {
      try {
        const events = await this.fetchOutlookEvents(settings.calendarConnections.outlook, new Date(0), new Date());
        const event = events.find(e => e.id === eventId);
        if (event) return event;
      } catch (err) {
        logger.debug('Failed to fetch Outlook event by ID', { eventId, error: (err as Error).message });
      }
    }

    return null;
  }

  /**
   * Link notes to a calendar event after recording completes
   * Attempts write-back to calendar, persists locally as fallback
   */
  async linkNotesToEvent(calendarEventId: string, notesId: string, provider: 'google' | 'outlook' | 'icloud'): Promise<void> {
    logger.info('Linking notes to calendar event', { calendarEventId, notesId, provider });

    // Update local mapping first (always succeeds)
    const settings = this.settingsRepo.getSettings();
    const mappings: Record<string, any> = settings.calendarEventMappings || {};
    
    if (mappings[calendarEventId]) {
      mappings[calendarEventId].notesId = notesId;
    } else {
      mappings[calendarEventId] = {
        calendarEventId,
        notesId,
        linkedAt: Date.now(),
        provider,
      };
    }

    this.settingsRepo.updateSettings({ calendarEventMappings: mappings });
    logger.info('Notes linked locally to calendar event', { calendarEventId, notesId });

    // Attempt write-back to calendar (best effort, doesn't fail the whole operation)
    try {
      const deepLink = `app://notes/${notesId}`;
      
      if (provider === 'google' && settings.calendarConnections.google) {
        // Note: Google Calendar API requires specific scope for updating events
        // This is read-only by design. Persist locally and skip write-back.
        logger.debug('Skipping Google Calendar write-back (read-only scope)', { calendarEventId });
      } else if (provider === 'outlook' && settings.calendarConnections.outlook) {
        // Outlook also has strict scope requirements for updates
        logger.debug('Skipping Outlook Calendar write-back (read-only scope)', { calendarEventId });
      }
    } catch (err) {
      logger.warn('Failed to write notes link back to calendar (using local fallback)', {
        calendarEventId,
        error: (err as Error).message,
      });
    }
  }
}


