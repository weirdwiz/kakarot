import { getDatabase, saveDatabase } from '../database';
import type { AppSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../config/constants';
import { createLogger } from '../../core/logger';

const logger = createLogger('SettingsRepository');

export class SettingsRepository {
  /**
   * Ensure default settings exist in database
   */
  initializeDefaults(): void {
    const db = getDatabase();
    const result = db.exec('SELECT COUNT(*) as count FROM settings');
    const count = result.length > 0 ? (result[0].values[0][0] as number) : 0;

    if (count === 0) {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
      }
      saveDatabase();
      logger.info('Initialized default settings');
    }
  }

  getSettings(): AppSettings {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM settings');
    if (result.length === 0) return DEFAULT_SETTINGS;

    const settings: Record<string, unknown> = {};
    for (let i = 0; i < result[0].values.length; i++) {
      const key = result[0].values[i][0] as string;
      const value = result[0].values[i][1] as string;
      settings[key] = JSON.parse(value);
    }

    const merged = { ...DEFAULT_SETTINGS, ...settings } as AppSettings;

    // Fall back to env vars if stored values are empty
    if (!merged.assemblyAiApiKey) {
      merged.assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY || '';
    }
    if (!merged.openAiApiKey) {
      merged.openAiApiKey = process.env.OPENAI_API_KEY || '';
    }

    return merged;
  }

  updateSettings(updates: Partial<AppSettings>): void {
    const db = getDatabase();
    for (const [key, value] of Object.entries(updates)) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value),
      ]);
    }
    saveDatabase();
    logger.info('Updated settings', { keys: Object.keys(updates) });
  }
}
