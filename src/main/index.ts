import { config } from 'dotenv';
import { resolve } from 'path';
import { app, BrowserWindow, systemPreferences, globalShortcut } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import { createCalloutWindow } from './windows/calloutWindow';
import { initializeDatabase, closeDatabase } from './data/database';
import { initializeContainer, getContainer } from './core/container';
import { registerAllHandlers } from './handlers';
import { createLogger } from './core/logger';
import { initializeErrorHandler } from './core/errorHandler';
import { startPerformanceLogging, stopPerformanceLogging } from './utils/performance';
import { showCalloutWindow } from './windows/calloutWindow';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import type { Callout } from '@shared/types';

// Load .env from project root
config({ path: resolve(__dirname, '../../.env') });

// Initialize global error handlers early
initializeErrorHandler();

const logger = createLogger('Main');

let mainWindow: BrowserWindow | null = null;
let calloutWindow: BrowserWindow | null = null;

// Make mainWindow globally accessible for notifications
declare global {
  var mainWindow: BrowserWindow | null;
}
global.mainWindow = null;

async function createWindows() {
  // Request microphone permission on macOS
  if (process.platform === 'darwin') {
    const currentStatus = systemPreferences.getMediaAccessStatus('microphone');
    logger.info('Microphone permission status', { status: currentStatus });

    if (currentStatus !== 'granted') {
      const micAccess = await systemPreferences.askForMediaAccess('microphone');
      logger.info('Microphone access request result', { granted: micAccess });
      if (!micAccess) {
        logger.warn('Microphone access denied - recording will not work');
      }
    }
  }

  await initializeDatabase();
  initializeContainer();

  mainWindow = createMainWindow();
  calloutWindow = createCalloutWindow();
  
  // Store mainWindow globally for notification service
  global.mainWindow = mainWindow;

  registerAllHandlers(mainWindow, calloutWindow);

  // Start meeting notification service
  const container = getContainer();
  container.meetingNotificationService.start();

  // Dev-only: Start performance logging and register keyboard shortcuts
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    startPerformanceLogging(60000); // Log every 60 seconds
    const resetShortcut = process.platform === 'darwin' ? 'Cmd+Shift+O' : 'Ctrl+Shift+O';
    globalShortcut.register(resetShortcut, () => {
      logger.info('Dev: Resetting onboarding via keyboard shortcut');
      mainWindow?.webContents.send('dev:reset-onboarding');
    });
    logger.info('Dev: Registered onboarding reset shortcut', { shortcut: resetShortcut });

    // Dev-only: Trigger test callout (Cmd/Ctrl+Option+T)
    const calloutShortcut = process.platform === 'darwin' ? 'Cmd+Option+T' : 'Ctrl+Alt+T';
    globalShortcut.register(calloutShortcut, () => {
      logger.info('Dev: Triggering test callout');
      const testCallout: Callout = {
        id: 'test-' + Date.now(),
        meetingId: 'test-meeting',
        triggeredAt: new Date(),
        question: 'What is the timeline for the next release?',
        context: 'Test context',
        suggestedResponse: 'Based on our sprint planning, we are targeting mid-February for the beta release, with the full release planned for early March.',
        sources: [],
        dismissed: false,
      };
      calloutWindow?.webContents.send(IPC_CHANNELS.CALLOUT_SHOW, testCallout);
      showCalloutWindow();
    });
    logger.info('Dev: Registered test callout shortcut', { shortcut: calloutShortcut });
  }

  logger.info('Application initialized');
}

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});

// Handle app quit - cleanup
app.on('before-quit', () => {
  stopPerformanceLogging();
  const container = getContainer();
  container.meetingNotificationService.stop();
  closeDatabase();
  logger.info('Application closing');
});

// Export windows for IPC access
export function getMainWindowInstance(): BrowserWindow | null {
  return mainWindow;
}

export function getCalloutWindow(): BrowserWindow | null {
  return calloutWindow;
}
