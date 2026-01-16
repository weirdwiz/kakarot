import { BrowserWindow } from 'electron';
import { registerRecordingHandlers } from './recordingHandlers';
import { registerMeetingHandlers } from './meetingHandlers';
import { registerSettingsHandlers } from './settingsHandlers';
import { registerCalloutHandlers } from './calloutHandlers';
import { registerCalendarHandlers } from './calendarHandlers';
import { registerPeopleHandlers } from './peopleHandlers';
import { registerCRMHandlers, setCRMHandlersMainWindow } from './crmHandlers';
import { registerChatHandlers } from './chatHandlers';
import { registerPrepHandlers } from './prepHandlers';
import { createLogger } from '../core/logger';

const logger = createLogger('Handlers');

export function registerAllHandlers(
  mainWindow: BrowserWindow,
  calloutWindow: BrowserWindow
): void {
  registerRecordingHandlers(mainWindow, calloutWindow);
  registerMeetingHandlers();
  registerSettingsHandlers();
  registerCalloutHandlers(calloutWindow);
  registerCalendarHandlers();
  registerPeopleHandlers();
  setCRMHandlersMainWindow(mainWindow);
  registerCRMHandlers();
  registerChatHandlers();
  registerPrepHandlers();

  logger.info('All IPC handlers registered');
}
