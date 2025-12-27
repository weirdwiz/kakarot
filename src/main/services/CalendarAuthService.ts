import { BrowserWindow, shell } from 'electron';
import { createLogger } from '../core/logger';
import { randomBytes } from 'crypto';
import type { Server } from 'http';
import type { CalendarTokens, CalendarProvider } from '@shared/types';

const logger = createLogger('CalendarAuthService');

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

// OAuth configurations for each provider
// Users will need to provide their own client IDs/secrets in settings
const OAUTH_CONFIGS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ],
    redirectUri: 'http://localhost:8888/oauth/callback',
  },
  outlook: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Calendars.Read', 'Calendars.Read.Shared', 'offline_access'],
    redirectUri: 'http://localhost:8888/oauth/callback',
  },
};

export class CalendarAuthService {
  private authWindow: BrowserWindow | null = null;
  private authServer: Server | null = null;
  private pendingAuth: {
    provider: CalendarProvider;
    resolve: (tokens: CalendarTokens | null) => void;
    state: string;
  } | null = null;

  async startOAuthFlow(
    provider: 'google' | 'outlook' | 'icloud',
    clientId: string,
    clientSecret?: string
  ): Promise<CalendarTokens | null> {
    logger.info('Starting OAuth flow', { provider });

    if (provider === 'icloud') {
      // iCloud uses CalDAV with app-specific passwords, not OAuth
      return this.handleICloudAuth();
    }

    const config = OAUTH_CONFIGS[provider];
    if (!config) {
      logger.error('Unknown provider', { provider });
      return null;
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Build authorization URL
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
    authUrl.searchParams.set('prompt', 'consent');

    // Create promise to wait for OAuth callback
    const authPromise = new Promise<CalendarTokens | null>((resolve) => {
      this.pendingAuth = { provider, resolve, state };
    });

    // Start local server to handle OAuth callback
    await this.startCallbackServer(clientId, clientSecret || '');

    // Open OAuth page in user's default browser
    await shell.openExternal(authUrl.toString());

    logger.info('OAuth URL opened in browser', { provider });

    // Wait for callback or timeout
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        logger.warn('OAuth flow timed out', { provider });
        this.stopCallbackServer();
        resolve(null);
      }, 300000); // 5 minute timeout
    });

    const result = await Promise.race([authPromise, timeoutPromise]);

    return result;
  }

  // iCloud uses CalDAV with app-specific passwords, not OAuth
  private async handleICloudAuth(): Promise<CalendarTokens | null> {
    logger.info('iCloud uses CalDAV authentication');
    
    // For iCloud, we'll return a placeholder token
    // The actual implementation will require username + app-specific password
    // which should be collected in the UI and stored securely
    return {
      accessToken: 'icloud_caldav_placeholder',
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year (no expiration for CalDAV)
    };
  }

  private async startCallbackServer(clientId: string, clientSecret: string): Promise<void> {
    const http = await import('http');
    const url = await import('url');

    this.authServer = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || '', true);

      if (parsedUrl.pathname === '/oauth/callback') {
        const { code, state, error } = parsedUrl.query;

        if (error) {
          logger.error('OAuth error in callback', { error });
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication failed</h1><p>You can close this window.</p></body></html>');
          
          if (this.pendingAuth) {
            this.pendingAuth.resolve(null);
            this.pendingAuth = null;
          }
          this.stopCallbackServer();
          return;
        }

        if (!code || !state) {
          logger.error('Missing code or state in callback');
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Invalid callback</h1></body></html>');
          return;
        }

        // Verify state
        if (this.pendingAuth && state === this.pendingAuth.state) {
          const provider = this.pendingAuth.provider;

          // iCloud uses CalDAV, not OAuth - should never reach this callback
          if (provider === 'icloud') {
            logger.error('iCloud should not use OAuth callback');
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Invalid provider</h1></body></html>');
            return;
          }

          // Exchange code for tokens
          const tokens = await this.exchangeCodeForTokens(
            provider,
            code as string,
            clientId,
            clientSecret
          );

          if (tokens) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1 style="color: #10B981;">Connected</h1>
              <p>You can close this window.</p>
            </body></html>`);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1 style="color: #EF4444;">Connection Failed</h1>
              <p>Could not complete authentication. Please try again.</p>
            </body></html>`);
          }

          this.pendingAuth.resolve(tokens);
          this.pendingAuth = null;
          this.stopCallbackServer();
        } else {
          logger.error('State mismatch in OAuth callback');
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Invalid state</h1></body></html>');
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.authServer.listen(8888, '127.0.0.1', () => {
      logger.info('OAuth callback server started on localhost:8888');
    });
  }

  private stopCallbackServer(): void {
    if (this.authServer) {
      this.authServer.close();
      this.authServer = null;
      logger.info('OAuth callback server stopped');
    }
  }

  private async exchangeCodeForTokens(
    provider: 'google' | 'outlook',
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<CalendarTokens | null> {
    const config = OAUTH_CONFIGS[provider];
    if (!config) return null;

    try {
      const params = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Token exchange failed', { provider, error });
        return null;
      }

      const data = await response.json();

      const tokens: CalendarTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
      };

      logger.info('Successfully exchanged code for tokens', { provider });
      return tokens;
    } catch (error) {
      logger.error('Error exchanging code for tokens', { provider, error });
      return null;
    }
  }

  async refreshToken(
    provider: 'google' | 'outlook',
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<CalendarTokens | null> {
    const config = OAUTH_CONFIGS[provider];
    if (!config) return null;

    try {
      const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Token refresh failed', { provider, error });
        return null;
      }

      const data = await response.json();

      const tokens: CalendarTokens = {
        accessToken: data.access_token,
        refreshToken: refreshToken, // Keep existing refresh token if new one not provided
        expiresAt: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
      };

      logger.info('Successfully refreshed access token', { provider });
      return tokens;
    } catch (error) {
      logger.error('Error refreshing token', { provider, error });
      return null;
    }
  }

  async revokeToken(
    provider: 'google' | 'outlook' | 'icloud',
    token: string
  ): Promise<boolean> {
    if (provider === 'icloud') {
      // For iCloud, just delete the stored credentials
      logger.info('Revoking iCloud CalDAV credentials');
      return true;
    }

    try {
      let revokeUrl: string;
      if (provider === 'google') {
        revokeUrl = `https://oauth2.googleapis.com/revoke?token=${token}`;
      } else if (provider === 'outlook') {
        // Microsoft doesn't have a simple revoke endpoint, tokens expire automatically
        logger.info('Outlook tokens will expire automatically');
        return true;
      } else {
        return false;
      }

      const response = await fetch(revokeUrl, { method: 'POST' });
      const success = response.ok;

      if (success) {
        logger.info('Successfully revoked token', { provider });
      } else {
        logger.warn('Failed to revoke token', { provider, status: response.status });
      }

      return success;
    } catch (error) {
      logger.error('Error revoking token', { provider, error });
      return false;
    }
  }
}
