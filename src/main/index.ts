import { config } from 'dotenv';
import { resolve } from 'path';
import { app, BrowserWindow, systemPreferences } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import { createCalloutWindow } from './windows/calloutWindow';
import { initializeDatabase, closeDatabase } from './data/database';
import { initializeContainer } from './core/container';
import { registerAllHandlers } from './handlers';
import { createLogger } from './core/logger';

// Load .env from project root
config({ path: resolve(__dirname, '../../.env') });

const logger = createLogger('Main');

let mainWindow: BrowserWindow | null = null;
let calloutWindow: BrowserWindow | null = null;

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

  registerAllHandlers(mainWindow, calloutWindow);

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
  closeDatabase();
  logger.info('Application closing');
});

// Export windows for IPC access
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getCalloutWindow(): BrowserWindow | null {
  return calloutWindow;
}
