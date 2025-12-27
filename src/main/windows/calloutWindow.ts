import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

let calloutWindow: BrowserWindow | null = null;

export function createCalloutWindow(): BrowserWindow {
  // Position in bottom-right corner of primary display
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  const windowWidth = 380;
  const windowHeight = 160;
  const margin = 20;

  calloutWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - margin,
    y: screenHeight - windowHeight - margin,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: false,
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    const baseUrl = process.env.VITE_DEV_SERVER_URL || `http://${process.env.VITE_DEV_SERVER_HOST || 'localhost'}:${process.env.VITE_DEV_SERVER_PORT || '5173'}`;
    calloutWindow.loadURL(`${baseUrl}/callout.html`);
  } else {
    calloutWindow.loadFile(join(__dirname, '../renderer/callout.html'));
  }

  return calloutWindow;
}

export function showCalloutWindow(): void {
  if (calloutWindow && !calloutWindow.isVisible()) {
    calloutWindow.showInactive();
  }
}

export function hideCalloutWindow(): void {
  if (calloutWindow && calloutWindow.isVisible()) {
    calloutWindow.hide();
  }
}

export function updateCalloutPosition(): void {
  if (!calloutWindow) return;

  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const [windowWidth, windowHeight] = calloutWindow.getSize();
  const margin = 20;

  calloutWindow.setPosition(
    screenWidth - windowWidth - margin,
    screenHeight - windowHeight - margin
  );
}
