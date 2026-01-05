import React, { useEffect, useCallback, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { useOnboardingStore } from './stores/onboardingStore';
import RecordingView from './components/RecordingView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import PrepView from './components/PrepView';
import PeopleView from './components/PeopleView';
import Sidebar from './components/Sidebar';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import type { AudioLevels } from '../shared/types';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  const { view, setRecordingState, setAudioLevels, setPartialSegment, addTranscriptSegment, setSettings } =
    useAppStore();
  const { isCompleted: onboardingCompleted, completeOnboarding, resetOnboarding } = useOnboardingStore();
  const [pillarTab, setPillarTab] = useState<'notes' | 'prep' | 'interact'>('notes');

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

    // Dev-only: Listen for onboarding reset shortcut (Cmd/Ctrl+Shift+O)
    const unsubDevReset = window.kakarot.dev.onResetOnboarding(() => {
      console.log('[DEV] Resetting onboarding via keyboard shortcut');
      resetOnboarding();
    });

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
      unsubDevReset();
      unsubState();
      unsubLevels();
      unsubTranscript();
      unsubFinal();
    };
  }, [setRecordingState, handleAudioLevels, setPartialSegment, addTranscriptSegment, setSettings, resetOnboarding]);

  // Show onboarding if not completed
  if (!onboardingCompleted) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return (
    <div className="flex h-screen bg-[#F3F4F6] dark:bg-[#050505]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Fixed Header */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 dark:bg-[#0C0C0C]/80 border-b border-slate-200 dark:border-[#1A1A1A] drag-region">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[48px] flex items-center justify-between">
            {/* Back button (left, next to traffic lights area) */}
            <div className="w-32 flex items-center no-drag">
              <button
                className="px-3 py-1.5 rounded-md text-sm text-slate-700 dark:text-slate-300 hover:bg-white/60 hover:dark:bg-white/5"
                onClick={() => {
                  const state = useAppStore.getState();
                  const isLive = state.recordingState === 'recording' || state.recordingState === 'paused' || state.recordingState === 'processing';
                  // Navigate to home/bento view; if live, keep recording running but swap to home shell
                  state.setView('recording');
                  setPillarTab('notes');
                  state.setActiveCalendarContext(null);
                  state.setCalendarContext(null);
                  state.setSelectedMeeting(null);
                  state.setShowRecordingHome(isLive);
                }}
              >
                <span className="inline-flex items-center gap-1">
                  ← Back
                </span>
              </button>
            </div>
            {/* Navigation Pills (Center) */}
            <div className="flex-1 flex justify-center no-drag">
              <div className="flex items-center gap-2 px-2 py-2 rounded-full border border-white/30 dark:border-white/10 bg-white/70 dark:bg-[#0C0C0C]/70">
                {(['notes','prep','interact'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPillarTab(tab)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                      pillarTab === tab
                        ? 'bg-emerald-mist text-onyx dark:bg-[#7C3AED] dark:text-white shadow-soft-card'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 hover:dark:bg-white/5'
                    }`}
                  >
                    {tab === 'notes' ? 'Home' : tab === 'prep' ? 'Prep' : 'Interact'}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Toggle (Right) */}
            <div className="w-32 flex justify-end no-drag"><ThemeToggle /></div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121212] shadow-soft-card">
              <div className="p-4 sm:p-6">
                {view === 'recording' && (
                  pillarTab === 'notes' ? (
                    <RecordingView onSelectTab={setPillarTab} />
                  ) : pillarTab === 'prep' ? (
                    <PrepView />
                  ) : (
                    <div className="h-[60vh] flex items-center justify-center text-center text-slate-500 dark:text-slate-400">
                      <div>
                        <p className="text-lg font-medium mb-2">Interact Space</p>
                        <p className="text-sm">This area is reserved for future features.</p>
                      </div>
                    </div>
                  )
                )}
                {view === 'history' && <HistoryView />}
                {view === 'people' && <PeopleView />}
                {view === 'settings' && <SettingsView />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
