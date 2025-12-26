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
}
