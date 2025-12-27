import { getDatabase, saveDatabase } from '../database';
import type { AppSettings } from '@shared/types';
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

    // API keys: env vars always win (more secure, easier to rotate)
    if (process.env.ASSEMBLYAI_API_KEY) {
      merged.assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY;
    }
    if (process.env.DEEPGRAM_API_KEY) {
      merged.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    }
    if (process.env.OPENAI_API_KEY) {
      merged.openAiApiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.OPENAI_BASE_URL) {
      merged.openAiBaseUrl = process.env.OPENAI_BASE_URL;
    }
    if (process.env.OPENAI_MODEL) {
      merged.openAiModel = process.env.OPENAI_MODEL;
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

  /**
   * Get a single setting value by key
   */
  async get(key: string): Promise<string | null> {
    const db = getDatabase();
    const result = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    return result[0].values[0][0] as string;
  }

  /**
   * Set a single setting value by key
   */
  async set(key: string, value: string): Promise<void> {
    const db = getDatabase();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    saveDatabase();
    logger.debug('Set setting', { key });
  }

  /**
   * Delete a setting by key
   */
  async delete(key: string): Promise<void> {
    const db = getDatabase();
    db.run('DELETE FROM settings WHERE key = ?', [key]);
    saveDatabase();
    logger.debug('Deleted setting', { key });
  }
}
