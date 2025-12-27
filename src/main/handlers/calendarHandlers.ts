import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import type { CalendarProvider } from '@shared/types';

const logger = createLogger('CalendarHandlers');

export function registerCalendarHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CALENDAR_LIST_TODAY, async () => {
    const { calendarService } = getContainer();
    logger.debug('Handling CALENDAR_LIST_TODAY');
    return calendarService.listToday();
  });

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_OAUTH_START,
    async (_, provider: CalendarProvider) => {
      const { calendarAuthService, tokenStorageService } = getContainer();
      logger.info('Starting OAuth flow', { provider });

      try {
        const credentials = await tokenStorageService.getClientCredentials(provider);
        if (!credentials) {
          logger.error('No credentials found for provider', { provider });
          return {
            success: false,
            error: 'Please configure OAuth credentials in Settings first',
          };
        }

        const tokens = await calendarAuthService.startOAuthFlow(
          provider,
          credentials.clientId,
          credentials.clientSecret
        );

        if (!tokens) {
          return {
            success: false,
            error: 'OAuth flow failed or was cancelled',
          };
        }

        await tokenStorageService.storeTokens(
          provider,
          tokens,
          credentials.clientId,
          credentials.clientSecret
        );

        logger.info('OAuth flow completed successfully', { provider });
        return { success: true };
      } catch (error) {
        logger.error('OAuth flow error', { provider, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_OAUTH_DISCONNECT,
    async (_, provider: CalendarProvider) => {
      const { calendarAuthService, tokenStorageService } = getContainer();
      logger.info('Disconnecting calendar', { provider });

      try {
        const data = await tokenStorageService.getTokens(provider);
        if (data) {
          await calendarAuthService.revokeToken(provider, data.tokens.accessToken);
        }
        await tokenStorageService.deleteTokens(provider);

        logger.info('Calendar disconnected successfully', { provider });
        return { success: true };
      } catch (error) {
        logger.error('Disconnect error', { provider, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.CALENDAR_OAUTH_STATUS, async () => {
    const { tokenStorageService } = getContainer();
    logger.debug('Getting calendar connection status');

    try {
      const providers: CalendarProvider[] = ['google', 'outlook', 'icloud'];
      const status: Record<CalendarProvider, boolean> = {
        google: false,
        outlook: false,
        icloud: false,
      };

      for (const provider of providers) {
        status[provider] = await tokenStorageService.hasTokens(provider);
      }

      return { success: true, status };
    } catch (error) {
      logger.error('Error getting connection status', { error });
      return {
        success: false,
        error: 'Failed to check calendar connections',
        status: { google: false, outlook: false, icloud: false },
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_CREDENTIALS_SAVE,
    async (
      _,
      provider: CalendarProvider,
      clientId: string,
      clientSecret?: string
    ) => {
      const { tokenStorageService } = getContainer();
      logger.info('Saving calendar credentials', { provider });

      try {
        await tokenStorageService.storeClientCredentials(
          provider,
          clientId,
          clientSecret
        );
        return { success: true };
      } catch (error) {
        logger.error('Error saving credentials', { provider, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_CREDENTIALS_GET,
    async (_, provider: CalendarProvider) => {
      const { tokenStorageService } = getContainer();
      logger.debug('Getting calendar credentials', { provider });

      try {
        const credentials = await tokenStorageService.getClientCredentials(provider);
        return { success: true, credentials: credentials || null };
      } catch (error) {
        logger.error('Error getting credentials', { provider, error });
        return {
          success: false,
          error: 'Failed to retrieve calendar credentials',
          credentials: null,
        };
      }
    }
  );
}

