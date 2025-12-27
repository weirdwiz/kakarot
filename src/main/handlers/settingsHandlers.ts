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

    // Refresh AI provider if API key or related settings changed
    if (settings.openAiApiKey !== undefined || settings.openAiBaseUrl !== undefined || settings.openAiModel !== undefined) {
      const currentSettings = settingsRepo.getSettings();
      refreshAIProvider({
        openAiApiKey: currentSettings.openAiApiKey,
        openAiBaseUrl: currentSettings.openAiBaseUrl,
        openAiModel: currentSettings.openAiModel,
      });
    }
  });
}
