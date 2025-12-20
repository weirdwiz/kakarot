import { BrowserWindow } from 'electron';
import { registerRecordingHandlers } from './recordingHandlers';
import { registerMeetingHandlers } from './meetingHandlers';
import { registerSettingsHandlers } from './settingsHandlers';
import { registerCalloutHandlers } from './calloutHandlers';
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

  logger.info('All IPC handlers registered');
}
