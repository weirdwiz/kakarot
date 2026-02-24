import { app, BrowserWindow, screen, session, shell } from 'electron';
import { join } from 'path';
import { createLogger } from '../core/logger';

const logger = createLogger('MainWindow');

let forceQuit = false;

export function setForceQuit(): void {
  forceQuit = true;
}

function setProductionCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: blob:; " +
            "worker-src 'self' blob:; " +
            "connect-src 'self' wss:;",
        ],
      },
    });
  });
}

export function createMainWindow(): BrowserWindow {
  if (app.isPackaged) {
    setProductionCSP();
  }

  // Center on the primary display so the window is always visible,
  // even if a previous session used a now-disconnected monitor.
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const windowWidth = 1200;
  const windowHeight = 800;

  const mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for sql.js WASM loading
    },
    titleBarStyle: 'hiddenInset',
    // Fine-tune macOS traffic light position (approx. 0.1–0.2 cm left shift)
    trafficLightPosition: { x: 16, y: 14 },
    show: true,
    backgroundColor: '#090909',
  });

  // macOS: hide instead of destroy on close, so dock click can re-show
  if (process.platform === 'darwin') {
    mainWindow.on('close', (event) => {
      if (!forceQuit) {
        event.preventDefault();
        mainWindow.hide();
      }
    });
  }

  mainWindow.on('unresponsive', () => {
    logger.warn('Window became unresponsive');
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!app.isPackaged) {
    const host = process.env.VITE_DEV_SERVER_HOST || 'localhost';
    const port = process.env.VITE_DEV_SERVER_PORT || '5173';
    const candidates = [
      process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL,
      `http://${host}:${port}`,
      port !== '5173' ? `http://${host}:5173` : null,
      `http://${host}:5174`,
    ].filter(Boolean) as string[];

    (async () => {
      for (const target of candidates) {
        try {
          await mainWindow.loadURL(target);
          mainWindow.webContents.openDevTools();
          return;
        } catch {
          logger.debug('Failed to load dev server candidate', { url: target });
        }
      }
      logger.error('All dev server candidates failed');
    })();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
