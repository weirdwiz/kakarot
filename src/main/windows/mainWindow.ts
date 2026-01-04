import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    trafficLightPosition: { x: 6, y: 10 },
    show: false,
  });

  // Show window when ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    console.log('[mainWindow] ready-to-show event fired, showing window');
    mainWindow.show();
  });

  // Add a timeout fallback in case ready-to-show doesn't fire
  setTimeout(() => {
    if (!mainWindow.isVisible()) {
      console.warn('[mainWindow] ready-to-show timeout - forcing window show');
      mainWindow.show();
    }
  }, 3000);

  // Log when page is loaded
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[mainWindow] did-finish-load event fired');
  });

  // Log any errors during page load
  mainWindow.on('unresponsive', () => {
    console.warn('[mainWindow] Window became unresponsive');
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app - check if we're in development
  const isDev = !app.isPackaged;

  if (isDev) {
    // In development, load from vite dev server
    // Use environment variable if available (set by vite-plugin-electron), fallback to 5173
    const port = process.env.VITE_DEV_SERVER_PORT || '5173';
    const host = process.env.VITE_DEV_SERVER_HOST || 'localhost';
    const url = `http://${host}:${port}`;
    console.log('[mainWindow] Loading dev server URL:', url);
    mainWindow.loadURL(url).catch((err) => {
      console.error('[mainWindow] Failed to load dev server:', err);
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
