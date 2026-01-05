import { BrowserWindow } from 'electron';
import axios from 'axios';
import { createLogger } from '../core/logger';

const logger = createLogger('HubSpotOAuthProvider');

export interface HubSpotOAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  connectedAt: number;
}

export class HubSpotOAuthProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri = 'http://localhost:3000/oauth/hubspot') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  async authenticate(mainWindow: BrowserWindow): Promise<HubSpotOAuthToken> {
    return new Promise((resolve, reject) => {
      // Create a temporary OAuth window
      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: true,
        parent: mainWindow,
        modal: true,
      });

      const scopes = ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read'];
      const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(
        this.redirectUri
      )}&scope=${encodeURIComponent(scopes.join(' '))}`;

      logger.info('Opening HubSpot OAuth window', {
        redirectUri: this.redirectUri,
        clientId: this.clientId,
        scopes,
      });

      authWindow.loadURL(authUrl);

      let isProcessingCode = false;

      const handleAuthCode = (code: string) => {
        if (isProcessingCode) return;
        isProcessingCode = true;

        logger.info('Authorization code received', { code: code.substring(0, 10) + '...' });
        
        // Remove the closed event listener to prevent rejection
        authWindow.removeAllListeners('closed');
        
        this.exchangeCodeForToken(code)
          .then((token) => {
            authWindow.destroy();
            resolve(token);
          })
          .catch((err) => {
            authWindow.destroy();
            reject(err);
          });
      };

      // Listen for redirect and extract auth code
      authWindow.webContents.on('will-redirect', (event, url) => {
        logger.debug('OAuth redirect detected', { url });
        
        // Check if this is our redirect URI
        if (url.startsWith(this.redirectUri)) {
          event.preventDefault();
          
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            authWindow.destroy();
            const errorDescription = urlObj.searchParams.get('error_description') || error;
            logger.error('OAuth authorization failed', { error, errorDescription });
            reject(new Error(`OAuth error: ${errorDescription}`));
            return;
          }

          if (code) {
            handleAuthCode(code);
            return;
          }
        }
      });

      // Also handle navigation event (backup for some OAuth flows)
      authWindow.webContents.on('will-navigate', (event, url) => {
        logger.debug('OAuth navigation detected', { url });
        
        if (url.startsWith(this.redirectUri)) {
          event.preventDefault();
          
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            authWindow.destroy();
            const errorDescription = urlObj.searchParams.get('error_description') || error;
            logger.error('OAuth authorization failed', { error, errorDescription });
            reject(new Error(`OAuth error: ${errorDescription}`));
            return;
          }

          if (code) {
            handleAuthCode(code);
            return;
          }
        }
      });

      authWindow.on('closed', () => {
        if (!isProcessingCode) {
          reject(new Error('OAuth window closed'));
        }
      });
    });
  }

  private async exchangeCodeForToken(code: string): Promise<HubSpotOAuthToken> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      });

      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      const token: HubSpotOAuthToken = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + expires_in * 1000,
        connectedAt: Date.now(),
      };

      logger.info('HubSpot token exchanged successfully');
      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to exchange code for token', { error: message });
      throw new Error(`Failed to authenticate with HubSpot: ${message}`);
    }
  }

  async refreshAccessToken(token: HubSpotOAuthToken): Promise<HubSpotOAuthToken> {
    if (!token.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: token.refreshToken,
      });

      const { access_token, expires_in } = response.data;

      return {
        ...token,
        accessToken: access_token,
        expiresAt: Date.now() + expires_in * 1000,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to refresh token', { error: message });
      throw new Error(`Failed to refresh HubSpot token: ${message}`);
    }
  }

  isTokenExpired(token: HubSpotOAuthToken): boolean {
    return Date.now() > token.expiresAt - 5 * 60 * 1000; // 5 min buffer
  }
}
