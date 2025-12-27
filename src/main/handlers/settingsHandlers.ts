import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer, refreshAIProvider } from '../core/container';
import type { AppSettings } from '@shared/types';

export function registerSettingsHandlers(): void {
  const { settingsRepo } = getContainer();

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return settingsRepo.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_, settings: Partial<AppSettings>) => {
    settingsRepo.updateSettings(settings);

    // Refresh AI provider if API key changed
    if (settings.openAiApiKey !== undefined) {
      const currentSettings = settingsRepo.getSettings();
      refreshAIProvider({
        apiKey: currentSettings.openAiApiKey,
        baseURL: currentSettings.openAiBaseUrl || undefined,
        defaultModel: currentSettings.openAiModel || undefined,
      });
    }
  });
}
