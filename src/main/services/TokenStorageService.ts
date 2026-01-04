import { safeStorage } from 'electron';
import { createLogger } from '../core/logger';
import { CalendarTokens } from './CalendarAuthService';

const logger = createLogger('TokenStorageService');

export type CalendarProvider = 'google' | 'outlook' | 'icloud';

interface StoredCalendarData {
  tokens: CalendarTokens;
  clientId: string;
  clientSecret?: string;
  userEmail?: string;
  connectedAt: number;
}

/**
 * Secure token storage using Electron's safeStorage API
 * Tokens are encrypted using OS-level encryption:
 * - macOS: Keychain
 * - Windows: DPAPI
 * - Linux: Secret Service API / libsecret
 */
export class TokenStorageService {
  private cache: Map<string, StoredCalendarData> = new Map();

  constructor(private settingsRepo: any) {
    this.loadFromSettings();
  }

  /**
   * Store calendar tokens securely
   */
  async storeTokens(
    provider: CalendarProvider,
    tokens: CalendarTokens,
    clientId: string,
    clientSecret?: string,
    userEmail?: string
  ): Promise<void> {
    try {
      const data: StoredCalendarData = {
        tokens,
        clientId,
        clientSecret,
        userEmail,
        connectedAt: Date.now(),
      };

      // Cache in memory
      this.cache.set(provider, data);

      // Encrypt and store
      if (safeStorage.isEncryptionAvailable()) {
        const json = JSON.stringify(data);
        const encrypted = safeStorage.encryptString(json);
        const base64 = encrypted.toString('base64');

        await this.settingsRepo.set(`calendar_${provider}_tokens`, base64);
        logger.info('Stored encrypted tokens', { provider });
      } else {
        logger.warn('Encryption not available, storing tokens in plaintext', { provider });
        const json = JSON.stringify(data);
        await this.settingsRepo.set(`calendar_${provider}_tokens`, json);
      }
    } catch (error) {
      logger.error('Failed to store tokens', { provider, error });
      throw error;
    }
  }

  /**
   * Retrieve calendar tokens
   */
  async getTokens(provider: CalendarProvider): Promise<StoredCalendarData | null> {
    // Check cache first
    if (this.cache.has(provider)) {
      return this.cache.get(provider)!;
    }

    try {
      const stored = await this.settingsRepo.get(`calendar_${provider}_tokens`);
      if (!stored) {
        return null;
      }

      let data: StoredCalendarData;

      if (safeStorage.isEncryptionAvailable()) {
        // Decrypt
        const encrypted = Buffer.from(stored, 'base64');
        const decrypted = safeStorage.decryptString(encrypted);
        data = JSON.parse(decrypted);
      } else {
        // Plaintext fallback - stored value is already a JSON string
        data = JSON.parse(stored);
      }

      // Cache for future access
      this.cache.set(provider, data);

      logger.debug('Retrieved tokens', { provider });
      return data;
    } catch {
      // Likely no tokens stored yet, not an error
      logger.debug('No tokens found for provider', { provider });
      return null;
    }
  }

  /**
   * Delete stored tokens for a provider
   */
  async deleteTokens(provider: CalendarProvider): Promise<void> {
    try {
      this.cache.delete(provider);
      await this.settingsRepo.delete(`calendar_${provider}_tokens`);
      logger.info('Deleted tokens', { provider });
    } catch (error) {
      logger.error('Failed to delete tokens', { provider, error });
      throw error;
    }
  }

  /**
   * Check if tokens exist for a provider
   */
  async hasTokens(provider: CalendarProvider): Promise<boolean> {
    if (this.cache.has(provider)) {
      return true;
    }

    const stored = await this.settingsRepo.get(`calendar_${provider}_tokens`);
    return !!stored;
  }

  /**
   * Check if access token is expired
   */
  isTokenExpired(tokens: CalendarTokens): boolean {
    return Date.now() >= tokens.expiresAt - (5 * 60 * 1000); // 5 minute buffer
  }

  /**
   * Get all connected providers
   */
  async getConnectedProviders(): Promise<CalendarProvider[]> {
    const providers: CalendarProvider[] = ['google', 'outlook', 'icloud'];
    const connected: CalendarProvider[] = [];

    for (const provider of providers) {
      if (await this.hasTokens(provider)) {
        connected.push(provider);
      }
    }

    return connected;
  }

  /**
   * Store client credentials (OAuth client ID/secret)
   */
  async storeClientCredentials(
    provider: CalendarProvider,
    clientId: string,
    clientSecret?: string
  ): Promise<void> {
    try {
      const data = { clientId, clientSecret };
      
      if (safeStorage.isEncryptionAvailable()) {
        const json = JSON.stringify(data);
        const encrypted = safeStorage.encryptString(json);
        const base64 = encrypted.toString('base64');
        await this.settingsRepo.set(`calendar_${provider}_credentials`, base64);
      } else {
        await this.settingsRepo.set(`calendar_${provider}_credentials`, JSON.stringify(data));
      }

      logger.info('Stored client credentials', { provider });
    } catch (error) {
      logger.error('Failed to store credentials', { provider, error });
      throw error;
    }
  }

  /**
   * Get client credentials
   */
  async getClientCredentials(
    provider: CalendarProvider
  ): Promise<{ clientId: string; clientSecret?: string } | null> {
    try {
      const stored = await this.settingsRepo.get(`calendar_${provider}_credentials`);
      if (!stored) {
        return null;
      }

      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = Buffer.from(stored, 'base64');
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      } else {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to retrieve credentials', { provider, error });
      return null;
    }
  }

  /**
   * Load tokens from settings into cache
   */
  private async loadFromSettings(): Promise<void> {
    const providers: CalendarProvider[] = ['google', 'outlook', 'icloud'];
    
    for (const provider of providers) {
      try {
        const data = await this.getTokens(provider);
        if (data) {
          this.cache.set(provider, data);
        }
      } catch (error) {
        logger.error('Failed to load tokens for provider', { provider, error });
      }
    }

    logger.debug('Loaded calendar tokens from settings');
  }

  /**
   * Clear all cached tokens
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Cleared token cache');
  }
}
