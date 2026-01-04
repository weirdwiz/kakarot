import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSettings } from '@shared/types';
import { Calendar, Unlink } from 'lucide-react';

export default function SettingsView() {
  const { settings, setSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [connectingProvider, setConnectingProvider] = useState<'google' | 'outlook' | 'icloud' | null>(null);
  const [connectingCRM, setConnectingCRM] = useState<'salesforce' | 'hubspot' | null>(null);
  const [connectedCalendars, setConnectedCalendars] = useState<{
    google: boolean;
    outlook: boolean;
    icloud: boolean;
  }>({
    google: false,
    outlook: false,
    icloud: false,
  });
  const [connectedCRMs, setConnectedCRMs] = useState<{
    salesforce: boolean;
    hubspot: boolean;
  }>({
    salesforce: false,
    hubspot: false,
  });
  const [googleCalendars, setGoogleCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [visibleGoogleIds, setVisibleGoogleIds] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
      setConnectedCalendars({
        google: !!settings.calendarConnections?.google,
        outlook: !!settings.calendarConnections?.outlook,
        icloud: !!settings.calendarConnections?.icloud,
      });
      setConnectedCRMs({
        salesforce: !!settings.crmConnections?.salesforce,
        hubspot: !!settings.crmConnections?.hubspot,
      });
      setVisibleGoogleIds(settings.visibleCalendars?.google || []);
    }
  }, [settings]);

  useEffect(() => {
    async function loadCalendars() {
      try {
        if (connectedCalendars.google) {
          const list = await window.kakarot.calendar.listCalendars('google');
          setGoogleCalendars(list);
        } else {
          setGoogleCalendars([]);
        }
      } catch (err) {
        console.warn('Failed to load calendars', err);
      }
    }
    loadCalendars();
  }, [connectedCalendars.google]);

  const handleChange = (key: keyof AppSettings, value: string | boolean) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, [key]: value });
  };

  const providerLabels: Record<'google' | 'outlook' | 'icloud', string> = {
    google: 'Google Calendar',
    outlook: 'Outlook Calendar',
    icloud: 'iCloud Calendar',
  };

  const handleConnectCalendar = async (provider: 'google' | 'outlook' | 'icloud') => {
    if (!localSettings) return;

    setConnectingProvider(provider);
    setSaveMessage('');

    try {
      let payload: { appleId: string; appPassword: string } | undefined;
      if (provider === 'icloud') {
        const appleId = prompt('Enter your Apple ID email for iCloud Calendar:');
        const appPassword = prompt('Enter your iCloud app-specific password:');
        if (!appleId || !appPassword) {
          throw new Error('Apple ID and app-specific password are required');
        }
        payload = { appleId, appPassword };
      }

      const connections = await window.kakarot.calendar.connect(provider, payload);
      const nextSettings = { ...localSettings, calendarConnections: connections };
      setLocalSettings(nextSettings);
      setSettings(nextSettings);
      setConnectedCalendars({
        google: !!connections.google,
        outlook: !!connections.outlook,
        icloud: !!connections.icloud,
      });
      setSaveMessage(`${providerLabels[provider]} connected`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveMessage(`Failed to connect ${providerLabels[provider]}: ${message}`);
    } finally {
      setConnectingProvider(null);
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  const handleDisconnectCalendar = async (provider: 'google' | 'outlook' | 'icloud') => {
    if (!localSettings) return;
    setConnectingProvider(provider);
    setSaveMessage('');

    try {
      const connections = await window.kakarot.calendar.disconnect(provider);
      const nextSettings = { ...localSettings, calendarConnections: connections };
      setLocalSettings(nextSettings);
      setSettings(nextSettings);
      setConnectedCalendars({
        google: !!connections.google,
        outlook: !!connections.outlook,
        icloud: !!connections.icloud,
      });
      setSaveMessage(`${providerLabels[provider]} disconnected`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveMessage(`Failed to disconnect ${providerLabels[provider]}: ${message}`);
    } finally {
      setConnectingProvider(null);
      setTimeout(() => setSaveMessage(''), 5000);
    }
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

  const handleConnectCRM = async (provider: 'salesforce' | 'hubspot') => {
    if (!localSettings) return;

    setConnectingCRM(provider);
    setSaveMessage('');

    try {
      // In a real implementation, this would trigger OAuth flow via IPC
      const result = await window.kakarot.crm?.connect(provider);
      if (result) {
        const nextConnections = {
          ...(localSettings.crmConnections || {}),
          [provider]: result,
        };
        const nextSettings = { ...localSettings, crmConnections: nextConnections };
        setLocalSettings(nextSettings);
        setSettings(nextSettings);
        setConnectedCRMs({
          ...connectedCRMs,
          [provider]: true,
        });
        setSaveMessage(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveMessage(`Failed to connect ${provider}: ${message}`);
    } finally {
      setConnectingCRM(null);
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  const handleDisconnectCRM = async (provider: 'salesforce' | 'hubspot') => {
    if (!localSettings) return;

    setConnectingCRM(provider);
    setSaveMessage('');

    try {
      await window.kakarot.crm?.disconnect(provider);
      const nextConnections = { ...(localSettings.crmConnections || {}) };
      delete nextConnections[provider];
      const nextSettings = { ...localSettings, crmConnections: nextConnections };
      setLocalSettings(nextSettings);
      setSettings(nextSettings);
      setConnectedCRMs({
        ...connectedCRMs,
        [provider]: false,
      });
      setSaveMessage(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveMessage(`Failed to disconnect ${provider}: ${message}`);
    } finally {
      setConnectingCRM(null);
      setTimeout(() => setSaveMessage(''), 5000);
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
              onClick={() =>
                connectedCalendars.google
                  ? handleDisconnectCalendar('google')
                  : handleConnectCalendar('google')
              }
              disabled={connectingProvider === 'google'}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                connectedCalendars.google
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {connectedCalendars.google ? 'Google Calendar Connected' : 'Connect Your Google Calendar'}
                  </p>
                  {connectedCalendars.google && (
                    <p className="text-xs text-gray-500">Syncing your Google events</p>
                  )}
                </div>
              </div>
              {connectedCalendars.google ? (
                <span className="text-sm text-green-400">
                  {connectingProvider === 'google' ? 'Disconnecting...' : 'Disconnect'}
                </span>
              ) : (
                <span className="text-sm text-primary-400">
                  {connectingProvider === 'google' ? 'Connecting...' : '+ Connect'}
                </span>
              )}
            </button>

            {/* Outlook Calendar */}
            <button
              onClick={() =>
                connectedCalendars.outlook
                  ? handleDisconnectCalendar('outlook')
                  : handleConnectCalendar('outlook')
              }
              disabled={connectingProvider === 'outlook'}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                connectedCalendars.outlook
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {connectedCalendars.outlook ? 'Outlook Calendar Connected' : 'Connect Your Outlook Calendar'}
                  </p>
                  {connectedCalendars.outlook && (
                    <p className="text-xs text-gray-500">Syncing your Outlook events</p>
                  )}
                </div>
              </div>
              {connectedCalendars.outlook ? (
                <span className="text-sm text-green-400">
                  {connectingProvider === 'outlook' ? 'Disconnecting...' : 'Disconnect'}
                </span>
              ) : (
                <span className="text-sm text-primary-400">
                  {connectingProvider === 'outlook' ? 'Connecting...' : '+ Connect'}
                </span>
              )}
            </button>

            {/* iCloud Calendar */}
            <button
              onClick={() =>
                connectedCalendars.icloud
                  ? handleDisconnectCalendar('icloud')
                  : handleConnectCalendar('icloud')
              }
              disabled={connectingProvider === 'icloud'}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                connectedCalendars.icloud
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {connectedCalendars.icloud ? 'iCloud Calendar Connected' : 'Connect Your iCloud Calendar'}
                  </p>
                  {connectedCalendars.icloud && (
                    <p className="text-xs text-gray-500">Syncing your iCloud events</p>
                  )}
                </div>
              </div>
              {connectedCalendars.icloud ? (
                <span className="text-sm text-green-400">
                  {connectingProvider === 'icloud' ? 'Disconnecting...' : 'Disconnect'}
                </span>
              ) : (
                <span className="text-sm text-primary-400">
                  {connectingProvider === 'icloud' ? 'Connecting...' : '+ Connect'}
                </span>
              )}
            </button>
          </div>
        </section>

        {/* Visible Calendars */}
        {connectedCalendars.google && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
              Visible Calendars
            </h2>
            <div className="space-y-2">
              {googleCalendars.length === 0 && (
                <p className="text-sm text-gray-400">No calendars found</p>
              )}
              {googleCalendars.map((cal) => {
                const enabled = visibleGoogleIds.includes(cal.id);
                return (
                  <div key={cal.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-700 bg-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                      <p className="text-sm text-white">{cal.name}</p>
                    </div>
                    <ToggleSwitch
                      enabled={enabled}
                      onChange={(on) => {
                        const next = on
                          ? Array.from(new Set([...visibleGoogleIds, cal.id]))
                          : visibleGoogleIds.filter((id) => id !== cal.id);
                        setVisibleGoogleIds(next);
                        const nextSettings = { ...localSettings!, visibleCalendars: { ...(localSettings!.visibleCalendars || {}), google: next } };
                        setLocalSettings(nextSettings);
                        window.kakarot.calendar.setVisibleCalendars('google', next).catch(() => {});
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* CRM Integrations */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
            CRM Integrations
          </h2>
          <p className="text-sm text-gray-400">
            Connect your CRM to automatically push meeting notes to contact records.
          </p>

          <div className="space-y-3">
            {/* Salesforce */}
            <button
              onClick={() =>
                connectedCRMs.salesforce
                  ? handleDisconnectCRM('salesforce')
                  : handleConnectCRM('salesforce')
              }
              disabled={connectingCRM === 'salesforce'}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                connectedCRMs.salesforce
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">
                  SF
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {connectedCRMs.salesforce ? 'Salesforce Connected' : 'Connect Salesforce'}
                  </p>
                  {connectedCRMs.salesforce && (
                    <p className="text-xs text-gray-500">Notes will be synced to contact records</p>
                  )}
                </div>
              </div>
              {connectedCRMs.salesforce ? (
                <span className="text-sm text-green-400">
                  {connectingCRM === 'salesforce' ? 'Disconnecting...' : 'Disconnect'}
                </span>
              ) : (
                <span className="text-sm text-primary-400">
                  {connectingCRM === 'salesforce' ? 'Connecting...' : '+ Connect'}
                </span>
              )}
            </button>

            {/* HubSpot */}
            <button
              onClick={() =>
                connectedCRMs.hubspot
                  ? handleDisconnectCRM('hubspot')
                  : handleConnectCRM('hubspot')
              }
              disabled={connectingCRM === 'hubspot'}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                connectedCRMs.hubspot
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gradient-to-br from-orange-400 to-orange-600 rounded text-white text-xs font-bold flex items-center justify-center">
                  HS
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {connectedCRMs.hubspot ? 'HubSpot Connected' : 'Connect HubSpot'}
                  </p>
                  {connectedCRMs.hubspot && (
                    <p className="text-xs text-gray-500">Notes will be synced to contact records</p>
                  )}
                </div>
              </div>
              {connectedCRMs.hubspot ? (
                <span className="text-sm text-green-400">
                  {connectingCRM === 'hubspot' ? 'Disconnecting...' : 'Disconnect'}
                </span>
              ) : (
                <span className="text-sm text-primary-400">
                  {connectingCRM === 'hubspot' ? 'Connecting...' : '+ Connect'}
                </span>
              )}
            </button>
          </div>

          {/* CRM Notes Behavior */}
          {(connectedCRMs.salesforce || connectedCRMs.hubspot) && (
            <div>
              <label className="block text-sm text-gray-300 mb-3">
                When sending notes to CRM
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer hover:border-gray-600 transition">
                  <input
                    type="radio"
                    name="crmNotes"
                    value="always"
                    checked={localSettings?.crmNotesBehavior === 'always' || localSettings?.crmNotesBehavior === undefined}
                    onChange={(e) => handleChange('crmNotesBehavior', e.target.value as any)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">Send All Notes Automatically</p>
                    <p className="text-xs text-gray-500">Notes are always pushed to participant records</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer hover:border-gray-600 transition">
                  <input
                    type="radio"
                    name="crmNotes"
                    value="ask"
                    checked={localSettings?.crmNotesBehavior === 'ask'}
                    onChange={(e) => handleChange('crmNotesBehavior', e.target.value as any)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">Ask Before Sending</p>
                    <p className="text-xs text-gray-500">You'll be prompted after each meeting</p>
                  </div>
                </label>
              </div>
            </div>
          )}
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
