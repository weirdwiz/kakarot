import { ipcMain, BrowserWindow } from 'electron';
import { SlackService } from '../services/SlackService';
import { createLogger } from '../core/logger';
import { IPC_CHANNELS } from '@shared/ipcChannels';

const logger = createLogger('SlackHandlers');
const slackService = new SlackService();

export function registerSlackHandlers() {

  ipcMain.handle(IPC_CHANNELS.SLACK_CONNECT, async () => {
    logger.info('Starting Slack OAuth flow');
    
    const authWindow = new BrowserWindow({
      width: 600, height: 700, show: true, modal: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const authUrl = slackService.getAuthorizationUrl();
    authWindow.loadURL(authUrl);

    return new Promise((resolve, reject) => {
      const OAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
      const timeout = setTimeout(() => {
        if (!authWindow.isDestroyed()) {
          authWindow.destroy();
        }
        reject(new Error('OAuth timed out'));
      }, OAUTH_TIMEOUT_MS);

      const cleanup = () => clearTimeout(timeout);

      const handleCallback = async (url: string) => {
        if (url.startsWith('http://localhost:3000/oauth/slack')) {
          cleanup();
          const rawUrl = new URL(url);
          const code = rawUrl.searchParams.get('code');

          if (code) {
            try {
              authWindow.destroy();
              const token = await slackService.exchangeCodeForToken(code);
              resolve(token);
            } catch (err) { reject(err); }
          } else {
             authWindow.destroy();
             reject(new Error('Auth failed'));
          }
        }
      };

      authWindow.webContents.on('will-redirect', (_e, url) => handleCallback(url));
      authWindow.webContents.on('will-navigate', (_e, url) => handleCallback(url));
      authWindow.on('closed', () => {
        cleanup();
        reject(new Error('Window closed'));
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.SLACK_GET_CHANNELS, async (_, accessToken: string) => {
    return await slackService.getChannels(accessToken);
  });

  ipcMain.handle(IPC_CHANNELS.SLACK_SEND_NOTE, async (_, { accessToken, channelId, text }: { accessToken: string; channelId: string; text: string }) => {
    return await slackService.sendNote(accessToken, channelId, text);
  });
  
  logger.info('Slack handlers registered');
}