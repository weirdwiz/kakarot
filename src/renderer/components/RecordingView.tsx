import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from '../hooks/useAudioCapture';
import AudioLevelMeter from './AudioLevelMeter';
import LiveTranscript from './LiveTranscript';
import BentoDashboard from './bento/BentoDashboard';
import { FileText, Square, Pause, Play, Search } from 'lucide-react';
import type { Meeting } from '@shared/types';

interface RecordingViewProps {
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

type RecordingPhase = 'recording' | 'generating_notes' | 'completed' | 'error';

export default function RecordingView({ onSelectTab }: RecordingViewProps) {
  const { recordingState, audioLevels, liveTranscript, currentPartials, clearLiveTranscript, lastCompletedNoteId, setLastCompletedNoteId } = useAppStore();
  const { startCapture, stopCapture, pause, resume } = useAudioCapture();
  const [phase, setPhase] = useState<RecordingPhase>('recording');
  const [completedMeeting, setCompletedMeeting] = useState<Meeting | null>(null);

  // Listen for notes generation events
  useEffect(() => {
    const handleNotesGenerating = () => {
      setPhase('generating_notes');
    };

    const handleNotesComplete = async (meetingId: string) => {
      try {
        const meeting = await window.kakarot.meeting.getById(meetingId);
        if (meeting) {
          setCompletedMeeting(meeting);
          setPhase('completed');
          setLastCompletedNoteId(meetingId);
        }
      } catch (error) {
        console.error('[RecordingView] Failed to fetch completed meeting:', error);
        setPhase('error');
      }
    };

    window.kakarot.meeting.onNotesGenerating(handleNotesGenerating);
    window.kakarot.meeting.onNotesComplete(handleNotesComplete);

    return () => {
      // Cleanup listeners if needed
    };
  }, [setLastCompletedNoteId]);

  const handleSelectTab = (tab: 'notes' | 'prep' | 'interact') => {
    onSelectTab?.(tab);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = 'User'; // TODO: Get from user settings
    if (hour < 12) return `Good Morning, ${userName}`;
    if (hour < 18) return `Good Afternoon, ${userName}`;
    return `Good Evening, ${userName}`;
  };

  const handleStartRecording = async () => {
    clearLiveTranscript();
    setPhase('recording');
    setCompletedMeeting(null);
    await window.kakarot.recording.start();
    await startCapture();
  };

  const handleStopRecording = async () => {
    await stopCapture();
    await window.kakarot.recording.stop();
  };

  const handlePauseRecording = async () => {
    pause();
    await window.kakarot.recording.pause();
  };

  const handleResumeRecording = async () => {
    resume();
    await window.kakarot.recording.resume();
  };

  const isRecording = recordingState === 'recording';
  const isPaused = recordingState === 'paused';
  const isIdle = recordingState === 'idle';

  return (
    <div className="h-full bg-studio text-slate-ink dark:bg-onyx dark:text-gray-100">
      <div className="mx-auto w-full px-4 sm:px-6 py-4 flex flex-col gap-4">
        {/* Greeting + Unified Action Row */}
        <div className="space-y-3">
          {/* Greeting */}
          <div>
            {isIdle ? (
              <h1 className="text-3xl font-medium text-slate-900 dark:text-white">
                {getGreeting()}
              </h1>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isRecording && 'Recording in progress... keep the conversation flowing'}
                {isPaused && 'Recording paused — resume when ready'}
              </p>
            )}
          </div>

          {/* Unified Action Row (Search + Take Notes) */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/30 dark:border-white/10 bg-transparent backdrop-blur-sm">
            {/* Search Bar */}
            {isIdle && (
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search meetings or notes"
                  className="w-full pl-10 pr-4 py-2 bg-white/70 dark:bg-graphite/80 border border-white/30 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 backdrop-blur-md transition"
                />
              </div>
            )}

            {/* Action Buttons */}
            {isIdle ? (
              <button
                onClick={handleStartRecording}
                className="px-4 py-2 bg-[#8B5CF6] text-white font-semibold rounded-lg flex items-center gap-2 shadow-soft-card transition hover:opacity-95 flex-shrink-0"
              >
                <FileText className="w-4 h-4" />
                + Take Notes
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                {isPaused ? (
                  <button
                    onClick={handleResumeRecording}
                    className="px-4 py-2 bg-[#8B5CF6] text-white font-semibold rounded-lg flex items-center gap-2 transition hover:opacity-95"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePauseRecording}
                    className="px-4 py-2 bg-slate-100 text-slate-ink font-semibold rounded-lg flex items-center gap-2 transition hover:bg-slate-200 dark:bg-slate-800/80 dark:text-gray-100 dark:hover:bg-slate-700"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-2 transition"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {(isRecording || isPaused) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-6xl mx-auto">
            <AudioLevelMeter label="Microphone (You)" level={audioLevels.mic} />
            <AudioLevelMeter label="System Audio (Others)" level={audioLevels.system} />
          </div>
        )}

        {/* Dashboard or live transcript - full height, no scroll */}
        <div className="flex-1 rounded-2xl bg-white/70 dark:bg-graphite/80 border border-white/30 dark:border-white/10 shadow-soft-card backdrop-blur-md overflow-hidden flex flex-col">
          {phase === 'generating_notes' ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B5CF6] mx-auto mb-4"></div>
                <p className="text-lg font-medium text-slate-900 dark:text-white">Generating notes...</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">This will just take a moment</p>
              </div>
            </div>
          ) : phase === 'completed' && completedMeeting ? (
            <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Meeting Complete</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{completedMeeting.title}</p>
              </div>

              {/* Notes Section */}
              {completedMeeting.notes && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Overview</h3>
                  <div className="prose prose-slate dark:prose-invert max-w-none bg-white/50 dark:bg-graphite/50 rounded-lg p-4 border border-white/30 dark:border-white/10">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{completedMeeting.notes.overview}</p>
                  </div>
                </div>
              )}

              {completedMeeting.notes?.notesMarkdown && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Detailed Notes</h3>
                  <div className="prose prose-slate dark:prose-invert max-w-none bg-white/50 dark:bg-graphite/50 rounded-lg p-4 border border-white/30 dark:border-white/10">
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{
                        __html: completedMeeting.notes.notesMarkdown.replace(/\n/g, '<br/>'),
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Transcript Section */}
              {completedMeeting.transcript && completedMeeting.transcript.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Transcript</h3>
                  <div className="bg-white/50 dark:bg-graphite/50 rounded-lg p-4 border border-white/30 dark:border-white/10 space-y-3">
                    {completedMeeting.transcript.map((segment, idx) => (
                      <div key={idx} className="text-sm">
                        <span className={`font-medium ${segment.source === 'mic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {segment.source === 'mic' ? 'You' : 'Other'}:
                        </span>
                        <span className="ml-2 text-slate-700 dark:text-slate-300">{segment.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isRecording || isPaused ? (
            <div className="h-full flex flex-col p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Live Transcript</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Local audio is highlighted in Emerald Mist.</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LiveTranscript segments={liveTranscript} currentPartials={currentPartials} />
              </div>
            </div>
          ) : (
            <BentoDashboard isRecording={isRecording || isPaused} onStartNotes={handleStartRecording} onSelectTab={handleSelectTab} />
          )}
        </div>
      </div>
    </div>
  );
}
