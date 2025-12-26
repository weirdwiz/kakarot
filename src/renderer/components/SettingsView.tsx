import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSettings } from '@shared/types';
import { Calendar, Check, X } from 'lucide-react';

export default function SettingsView() {
  const { settings, setSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [connectedCalendars, setConnectedCalendars] = useState<{
    google: boolean;
    outlook: boolean;
    icloud: boolean;
  }>({
    google: false,
    outlook: false,
    icloud: false,
  });
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState<{
    provider: 'google' | 'outlook' | 'icloud' | null;
  }>({ provider: null });

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
    
    // Load calendar connection status
    loadCalendarStatus();
  }, [settings]);

  const loadCalendarStatus = async () => {
    try {
      const status = await window.kakarot.calendar.oauth.getStatus();
      setConnectedCalendars(status);
    } catch (error) {
      console.error('Failed to load calendar status:', error);
    }
  };

  const handleChange = (key: keyof AppSettings, value: string | boolean) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, [key]: value });
  };

  const handleSave = async () => {
    if (!localSettings) return;

    setIsSaving(true);
    setSaveMessage('');

    try {
      await window.kakarot.settings.update(localSettings);
      setSettings(localSettings);
      setSaveMessage('Settings saved successfully');
    } catch {
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleSelectKnowledgePath = async () => {
    // In a real implementation, this would open a file dialog
    // For now, we'll use a prompt
    const path = prompt('Enter the path to your knowledge base folder:');
    if (path) {
      handleChange('knowledgeBasePath', path);
    }
  };

  const handleConnectCalendar = async (provider: 'google' | 'outlook' | 'icloud') => {
    // If already connected, disconnect
    if (connectedCalendars[provider]) {
      setIsConnecting(provider);
      try {
        const result = await window.kakarot.calendar.oauth.disconnect(provider);
        if (result.success) {
          setConnectedCalendars((prev) => ({ ...prev, [provider]: false }));
          setSaveMessage(`${provider} calendar disconnected`);
        } else {
          setSaveMessage(`Failed to disconnect: ${result.error}`);
        }
      } catch (error) {
        setSaveMessage('Failed to disconnect calendar');
        console.error('Disconnect error:', error);
      } finally {
        setIsConnecting(null);
        setTimeout(() => setSaveMessage(''), 3000);
      }
      return;
    }

    // Check if credentials are configured
    const credentials = await window.kakarot.calendar.credentials.get(provider);
    if (!credentials) {
      // Show modal to input credentials
      setShowCredentialsModal({ provider });
      return;
    }

    // Start OAuth flow
    setIsConnecting(provider);
    try {
      const result = await window.kakarot.calendar.oauth.start(provider);
      if (result.success) {
        setConnectedCalendars((prev) => ({ ...prev, [provider]: true }));
        setSaveMessage(`${provider} calendar connected successfully!`);
      } else {
        setSaveMessage(`Failed to connect: ${result.error}`);
      }
    } catch (error) {
      setSaveMessage('Failed to connect calendar');
      console.error('OAuth error:', error);
    } finally {
      setIsConnecting(null);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  if (!localSettings) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure your API keys and preferences
          </p>
        </div>

        {/* API Keys */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
            API Keys
          </h2>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              AssemblyAI API Key
            </label>
            <input
              type="password"
              value={localSettings.assemblyAiApiKey}
              onChange={(e) => handleChange('assemblyAiApiKey', e.target.value)}
              placeholder="Enter your AssemblyAI API key"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a
                href="https://www.assemblyai.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline"
              >
                assemblyai.com/dashboard
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Deepgram API Key
            </label>
            <input
              type="password"
              value={localSettings.deepgramApiKey}
              onChange={(e) => handleChange('deepgramApiKey', e.target.value)}
              placeholder="Enter your Deepgram API key"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a
                href="https://console.deepgram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline"
              >
                console.deepgram.com
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={localSettings.openAiApiKey}
              onChange={(e) => handleChange('openAiApiKey', e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
        </section>

        {/* Knowledge Base */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
            Knowledge Base
          </h2>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Knowledge Base Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.knowledgeBasePath}
                onChange={(e) => handleChange('knowledgeBasePath', e.target.value)}
                placeholder="/path/to/your/documents"
                className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleSelectKnowledgePath}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Folder containing your reference documents (PDFs, markdown, text files)
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
            Features
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Auto-detect Questions</p>
              <p className="text-xs text-gray-500">
                Automatically detect when someone asks you a question
              </p>
            </div>
            <ToggleSwitch
              enabled={localSettings.autoDetectQuestions}
              onChange={(enabled) => handleChange('autoDetectQuestions', enabled)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Show Floating Callout</p>
              <p className="text-xs text-gray-500">
                Display a floating overlay when questions are detected
              </p>
            </div>
            <ToggleSwitch
              enabled={localSettings.showFloatingCallout}
              onChange={(enabled) => handleChange('showFloatingCallout', enabled)}
            />
          </div>
        </section>

        {/* Transcription */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
            Transcription
          </h2>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Provider</label>
            <select
              value={localSettings.transcriptionProvider}
              onChange={(e) => handleChange('transcriptionProvider', e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="assemblyai">AssemblyAI</option>
              <option value="deepgram">Deepgram</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select which transcription service to use
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Language</label>
            <select
              value={localSettings.transcriptionLanguage}
              onChange={(e) => handleChange('transcriptionLanguage', e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>
        </section>

        {/* Calendar Integrations */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
            Calendar Integrations
          </h2>
          <p className="text-sm text-gray-400">
            Connect your calendars to automatically prepare for upcoming meetings
          </p>

          <div className="space-y-3">
            {/* Google Calendar */}
            <button
              onClick={() => handleConnectCalendar('google')}
              disabled={isConnecting !== null}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all disabled:opacity-50 ${
                connectedCalendars.google
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {isConnecting === 'google' 
                      ? 'Connecting...' 
                      : connectedCalendars.google 
                        ? 'Google Calendar Connected' 
                        : 'Connect Your Google Calendar'}
                  </p>
                  {connectedCalendars.google && isConnecting !== 'google' && (
                    <p className="text-xs text-gray-500">Syncing your Google events</p>
                  )}
                </div>
              </div>
              {connectedCalendars.google ? (
                isConnecting === 'google' ? (
                  <span className="text-sm text-gray-400">...</span>
                ) : (
                  <Check className="w-5 h-5 text-green-500" />
                )
              ) : (
                <span className="text-sm text-primary-400">+ Connect</span>
              )}
            </button>

            {/* Outlook Calendar */}
            <button
              onClick={() => handleConnectCalendar('outlook')}
              disabled={isConnecting !== null}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all disabled:opacity-50 ${
                connectedCalendars.outlook
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {isConnecting === 'outlook' 
                      ? 'Connecting...' 
                      : connectedCalendars.outlook 
                        ? 'Outlook Calendar Connected' 
                        : 'Connect Your Outlook Calendar'}
                  </p>
                  {connectedCalendars.outlook && isConnecting !== 'outlook' && (
                    <p className="text-xs text-gray-500">Syncing your Outlook events</p>
                  )}
                </div>
              </div>
              {connectedCalendars.outlook ? (
                isConnecting === 'outlook' ? (
                  <span className="text-sm text-gray-400">...</span>
                ) : (
                  <Check className="w-5 h-5 text-green-500" />
                )
              ) : (
                <span className="text-sm text-primary-400">+ Connect</span>
              )}
            </button>

            {/* iCloud Calendar */}
            <button
              onClick={() => handleConnectCalendar('icloud')}
              disabled={isConnecting !== null}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all disabled:opacity-50 ${
                connectedCalendars.icloud
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {isConnecting === 'icloud' 
                      ? 'Connecting...' 
                      : connectedCalendars.icloud 
                        ? 'iCloud Calendar Connected' 
                        : 'Connect Your iCloud Calendar'}
                  </p>
                  {connectedCalendars.icloud && isConnecting !== 'icloud' && (
                    <p className="text-xs text-gray-500">Syncing your iCloud events</p>
                  )}
                </div>
              </div>
              {connectedCalendars.icloud ? (
                isConnecting === 'icloud' ? (
                  <span className="text-sm text-gray-400">...</span>
                ) : (
                  <Check className="w-5 h-5 text-green-500" />
                )
              ) : (
                <span className="text-sm text-primary-400">+ Connect</span>
              )}
            </button>
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          {saveMessage && (
            <p className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
              {saveMessage}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ml-auto px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Calendar Credentials Modal */}
      {showCredentialsModal.provider && (
        <CalendarCredentialsModal
          provider={showCredentialsModal.provider}
          onClose={() => setShowCredentialsModal({ provider: null })}
          onSave={async (clientId, clientSecret) => {
            const provider = showCredentialsModal.provider!;
            const result = await window.kakarot.calendar.credentials.save(
              provider,
              clientId,
              clientSecret
            );
            
            if (result.success) {
              setShowCredentialsModal({ provider: null });
              // Now start OAuth flow
              handleConnectCalendar(provider);
            } else {
              alert(`Failed to save credentials: ${result.error}`);
            }
          }}
        />
      )}
    </div>
  );
}

interface CalendarCredentialsModalProps {
  provider: 'google' | 'outlook' | 'icloud';
  onClose: () => void;
  onSave: (clientId: string, clientSecret?: string) => Promise<void>;
}

function CalendarCredentialsModal({ provider, onClose, onSave }: CalendarCredentialsModalProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim()) return;

    setIsSaving(true);
    try {
      await onSave(clientId.trim(), clientSecret.trim() || undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const providerInfo = {
    google: {
      name: 'Google Calendar',
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
      needsSecret: true,
      instructions: [
        '1. Go to Google Cloud Console',
        '2. Create or select a project',
        '3. Enable Google Calendar API',
        '4. Create OAuth 2.0 credentials (Desktop app)',
        '5. Copy Client ID and Client Secret',
      ],
    },
    outlook: {
      name: 'Outlook Calendar',
      docsUrl: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      needsSecret: true,
      instructions: [
        '1. Go to Azure Portal',
        '2. Register a new application',
        '3. Add redirect URI: http://localhost:8888/oauth/callback',
        '4. Add API permissions: Calendars.Read',
        '5. Create a client secret',
        '6. Copy Application (client) ID and secret',
      ],
    },
    icloud: {
      name: 'iCloud Calendar',
      docsUrl: 'https://appleid.apple.com/account/manage',
      needsSecret: false,
      instructions: [
        '1. Go to appleid.apple.com',
        '2. Sign in with your Apple ID',
        '3. Generate an app-specific password',
        '4. Use your Apple ID email as Client ID',
        '5. Use the app-specific password as Client Secret',
      ],
    },
  };

  const info = providerInfo[provider];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Configure {info.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-white">Setup Instructions:</p>
            <ul className="text-xs text-gray-400 space-y-1">
              {info.instructions.map((instruction, i) => (
                <li key={i}>{instruction}</li>
              ))}
            </ul>
            <a
              href={info.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-primary-400 hover:underline mt-2"
            >
              Open {provider === 'icloud' ? 'Apple ID' : provider === 'google' ? 'Google Cloud Console' : 'Azure Portal'} →
            </a>
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {provider === 'icloud' ? 'Apple ID Email' : 'Client ID'}
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={provider === 'icloud' ? 'your@icloud.com' : 'Enter Client ID'}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {/* Client Secret */}
          {info.needsSecret && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {provider === 'icloud' ? 'App-Specific Password' : 'Client Secret'}
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={provider === 'icloud' ? 'Enter app-specific password' : 'Enter Client Secret'}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required={provider !== 'google'} // Google can work without secret for some flows
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !clientId.trim()}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-primary-600' : 'bg-gray-600'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
