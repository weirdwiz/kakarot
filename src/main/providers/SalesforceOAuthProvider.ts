import { BrowserWindow } from 'electron';
import type { SalesforceOAuthToken } from '../services/SalesforceService';
import { SalesforceService } from '../services/SalesforceService';
import { createLogger } from '../core/logger';

const logger = createLogger('SalesforceOAuthProvider');

export type { SalesforceOAuthToken };

export class SalesforceOAuthProvider {
  private salesforceService: SalesforceService;
  private redirectUri: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri = 'http://localhost:3000/oauth/salesforce'
  ) {
    this.redirectUri = redirectUri;
    this.salesforceService = new SalesforceService(clientId, clientSecret, redirectUri);
  }

  async authenticate(mainWindow: BrowserWindow): Promise<SalesforceOAuthToken> {
    return new Promise((resolve, reject) => {
      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: true,
        parent: mainWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authUrl = this.salesforceService.getAuthorizationUrl();

      logger.info('Opening Salesforce OAuth window', {
        redirectUri: this.redirectUri,
        authUrl,
      });

      authWindow.loadURL(authUrl);

      let isProcessingCode = false;

      const handleAuthCode = (code: string) => {
        if (isProcessingCode) return;
        isProcessingCode = true;

        logger.info('Authorization code received', { code: code.substring(0, 10) + '...' });

        authWindow.removeAllListeners('closed');
        authWindow.webContents.removeAllListeners('will-redirect');
        authWindow.webContents.removeAllListeners('will-navigate');
        authWindow.webContents.removeAllListeners('did-finish-load');

        this.salesforceService
          .exchangeCodeForToken(code)
          .then((token) => {
            authWindow.destroy();
            resolve(token);
          })
          .catch((err) => {
            authWindow.destroy();
            reject(err);
          });
      };

      const checkUrlForCode = (url: string): boolean => {
        logger.debug('Checking URL for authorization code', { url });

        // Check if this is our redirect URI
        if (url.startsWith(this.redirectUri)) {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            authWindow.destroy();
            const errorDescription = urlObj.searchParams.get('error_description') || error;
            logger.error('OAuth authorization failed', { error, errorDescription });
            reject(new Error(`OAuth error: ${errorDescription}`));
            return true;
          }

          if (code) {
            handleAuthCode(code);
            return true;
          }
        }
        return false;
      };

      authWindow.webContents.on('did-finish-load', () => {
        const currentUrl = authWindow.webContents.getURL();
        logger.debug('Page finished loading', { url: currentUrl });
        checkUrlForCode(currentUrl);
      });

      authWindow.webContents.on('will-redirect', (event, url) => {
        logger.debug('OAuth redirect detected', { url });
        if (checkUrlForCode(url)) {
          event.preventDefault();
        }
      });

      authWindow.webContents.on('will-navigate', (event, url) => {
        logger.debug('OAuth navigation detected', { url });
        if (checkUrlForCode(url)) {
          event.preventDefault();
        }
      });

      authWindow.on('closed', () => {
        if (!isProcessingCode) {
          logger.warn('OAuth window closed by user');
          reject(new Error('OAuth window closed'));
        }
      });
    });
  }
}
