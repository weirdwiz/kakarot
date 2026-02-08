import { BrowserWindow } from 'electron';
import { registerRecordingHandlers } from './recordingHandlers';
import { registerMeetingHandlers } from './meetingHandlers';
import { registerSettingsHandlers } from './settingsHandlers';
import { registerCalloutHandlers } from './calloutHandlers';
import { registerCalendarHandlers } from './calendarHandlers';
import { registerPeopleHandlers } from './peopleHandlers';
import { registerBranchHandlers } from './branchHandlers';
import { registerCRMHandlers, setCRMHandlersMainWindow } from './crmHandlers';
import { registerChatHandlers } from './chatHandlers';
import { registerPrepHandlers } from './prepHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { createLogger } from '../core/logger';

const logger = createLogger('Handlers');

export function registerAllHandlers(
  mainWindow: BrowserWindow,
  calloutWindow: BrowserWindow
): void {
  registerRecordingHandlers(mainWindow, calloutWindow);
  registerMeetingHandlers();
  registerSettingsHandlers();
  registerCalloutHandlers();
  registerCalendarHandlers();
  registerPeopleHandlers();
  registerBranchHandlers();
  setCRMHandlersMainWindow(mainWindow);
  registerCRMHandlers();
  registerChatHandlers();
  registerPrepHandlers();
  registerDialogHandlers();

  logger.info('All IPC handlers registered');
}
