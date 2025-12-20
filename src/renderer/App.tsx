import React, { useEffect, useCallback } from 'react';
import { useAppStore } from './stores/appStore';
import RecordingView from './components/RecordingView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import Sidebar from './components/Sidebar';
import type { AudioLevels } from '../shared/types';

export default function App() {
  const { view, setRecordingState, setAudioLevels, setPartialSegment, addTranscriptSegment, setSettings } =
    useAppStore();

  // Handler that merges incoming audio levels with existing state
  // This allows main process to send partial updates (e.g., just { system: level })
  const handleAudioLevels = useCallback((levels: Partial<AudioLevels>) => {
    const currentLevels = useAppStore.getState().audioLevels;
    setAudioLevels({
      ...currentLevels,
      ...levels,
    });
  }, [setAudioLevels]);

  useEffect(() => {
    // Load initial settings
    window.kakarot.settings.get().then(setSettings);

    // Subscribe to recording state changes
    const unsubState = window.kakarot.recording.onStateChange(setRecordingState);

    // Subscribe to audio levels (handler merges partial updates)
    const unsubLevels = window.kakarot.audio.onLevels(handleAudioLevels);

    // Subscribe to transcript updates (partials replace, finals append)
    const unsubTranscript = window.kakarot.transcript.onUpdate((update) => {
      setPartialSegment(update.segment);
    });

    const unsubFinal = window.kakarot.transcript.onFinal((update) => {
      addTranscriptSegment(update.segment);
    });

    return () => {
      unsubState();
      unsubLevels();
      unsubTranscript();
      unsubFinal();
    };
  }, [setRecordingState, handleAudioLevels, setPartialSegment, addTranscriptSegment, setSettings]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {view === 'recording' && <RecordingView />}
        {view === 'history' && <HistoryView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
