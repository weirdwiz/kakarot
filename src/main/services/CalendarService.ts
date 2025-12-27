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

    await shell.openExternal(authUrl.toString());
    logger.info('Opened OAuth browser flow', { provider: config.provider });

    const code = await redirectServer.waitForCode;
    redirectServer.close();

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

  private async fetchGoogleEvents(tokens: OAuthTokens, start: Date, end: Date): Promise<CalendarEvent[]> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];

    const freshTokens = await this.ensureFreshToken('google', tokens, {
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId,
      clientSecret,
    });

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
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
}
