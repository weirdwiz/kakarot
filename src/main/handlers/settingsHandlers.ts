import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import type { AppSettings } from '@shared/types';

export function registerSettingsHandlers(): void {
  const { settingsRepo } = getContainer();

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return settingsRepo.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_, settings: Partial<AppSettings>) => {
    settingsRepo.updateSettings(settings);
    // AI provider is now managed server-side via the backend
    // No local API key refresh needed
  });
}
