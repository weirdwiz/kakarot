import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';

const logger = createLogger('CalendarHandlers');

export function registerCalendarHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CALENDAR_LIST_TODAY, async () => {
    const { calendarService } = getContainer();
    logger.debug('Handling CALENDAR_LIST_TODAY');
    return calendarService.listToday();
  });

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_CONNECT,
    async (_event, provider: 'google' | 'outlook' | 'icloud', payload?: { appleId: string; appPassword: string }) => {
      const { calendarService } = getContainer();
      logger.debug('Handling CALENDAR_CONNECT', { provider });
      return calendarService.connect(provider, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_DISCONNECT,
    async (_event, provider: 'google' | 'outlook' | 'icloud') => {
      const { calendarService } = getContainer();
      logger.debug('Handling CALENDAR_DISCONNECT', { provider });
      return calendarService.disconnect(provider);
    }
  );
}
