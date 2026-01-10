import React from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from '../hooks/useAudioCapture';
import AudioLevelMeter from './AudioLevelMeter';
import LiveTranscript from './LiveTranscript';
import BentoDashboard from './bento/BentoDashboard';
import MeetingContextPreview from './MeetingContextPreview';
import { FileText, Square, Pause, Play, Search, Loader2 } from 'lucide-react';
import { formatDateTime } from '../lib/formatters';

interface RecordingViewProps {
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

// TODO(refactor): This component is 360+ lines and handles too many responsibilities:
// greeting, search, recording controls, live transcript, note generation status,
// completed meeting display, and error handling.
// Split into: RecordingHeader, RecordingControls, CompletedMeetingView, RecordingError
export default function RecordingView({ onSelectTab }: RecordingViewProps) {
  const { recordingState, audioLevels, liveTranscript, currentPartials, clearLiveTranscript, calendarContext, setCalendarContext, activeCalendarContext, setActiveCalendarContext, setLastCompletedNoteId, setSelectedMeeting, setView } = useAppStore();
  const { startCapture, stopCapture, pause, resume } = useAudioCapture();
  const [pillarTab, setPillarTab] = React.useState<'notes' | 'prep' | 'interact'>('notes');
  const [recordingTitle, setRecordingTitle] = React.useState<string>(''); // Title to display during recording
  const [phase, setPhase] = React.useState<'recording' | 'generating_notes' | 'completed' | 'error'>('recording');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [completedMeeting, setCompletedMeeting] = React.useState<any>(null);

  // Forward tab changes to parent if handler provided
  const handleSelectTab = (tab: 'notes' | 'prep' | 'interact') => {
    setPillarTab(tab);
    onSelectTab?.(tab);
  };

  // Hook into meeting notes completion event
  React.useEffect(() => {
    const unsubscribe = window.kakarot.recording.onNotesComplete?.((data: { meetingId: string; title: string; overview: string }) => {
      console.log('[RecordingView] Notes completed:', data);
      // Fetch the full meeting and display inline
      window.kakarot.meetings.get(data.meetingId)
        .then((meeting) => {
          if (meeting) {
            const hasNotes = Boolean((meeting as any).notesMarkdown || (meeting as any).overview);
            if (hasNotes) {
              setLastCompletedNoteId(data.meetingId);
              setCompletedMeeting(meeting);
              setPhase('completed');
              console.log('[RecordingView] Notes generated and displayed inline:', data.meetingId);
            } else {
              setPhase('error');
              setErrorMessage('Notes generation failed. You can still view the transcript.');
              console.warn('[RecordingView] Notes generation appears to have failed.');
            }
          }
        })
        .catch((err) => {
          setPhase('error');
          setErrorMessage('Something went wrong loading your meeting.');
          console.error('[RecordingView] Failed to load meeting after notes completion:', err);
        });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setLastCompletedNoteId]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = 'User'; // TODO: Get from user settings
    if (hour < 12) return `Good Morning, ${userName}`;
    if (hour < 18) return `Good Afternoon, ${userName}`;
    return `Good Evening, ${userName}`;
  };

  const handleStartRecording = async () => {
    console.log('[RecordingView] Start button clicked');
    clearLiveTranscript();
    setPhase('recording');
    setCompletedMeeting(null);
    setErrorMessage('');
    
    // Set the recording title from calendar context
    if (activeCalendarContext) {
      setRecordingTitle(activeCalendarContext.title);
    } else {
      setRecordingTitle(`Meeting ${formatDateTime(new Date())}`);
    }
    
    try {
      console.log('[RecordingView] Calling recording.start()...');
      // Pass active calendar context if available
      const calendarContextData = activeCalendarContext ? {
        calendarEventId: activeCalendarContext.id,
        calendarEventTitle: activeCalendarContext.title,
        calendarEventAttendees: activeCalendarContext.attendees,
        calendarEventStart: activeCalendarContext.start.toISOString(),
        calendarEventEnd: activeCalendarContext.end.toISOString(),
        calendarProvider: activeCalendarContext.provider,
      } : undefined;
      
      await window.kakarot.recording.start(calendarContextData);
      console.log('[RecordingView] recording.start() completed, calling startCapture()...');
      await startCapture();
      console.log('[RecordingView] startCapture() completed');
      setPhase('recording');
      
      // Clear the preview modal now that recording has started
      setCalendarContext(null);
    } catch (error) {
      console.error('[RecordingView] Error starting recording:', error);
    }
  };

  const handleStopRecording = async () => {
    setPhase('generating_notes');
    setErrorMessage('');
    await stopCapture();
    const meeting = await window.kakarot.recording.stop();
    console.log('Meeting ended:', meeting);
    
    // If there was a calendar context for this recording, link the notes back
    if (activeCalendarContext && meeting) {
      try {
        const provider = activeCalendarContext.provider as 'google' | 'outlook' | 'icloud';
        await window.kakarot.calendar.linkNotes(
          activeCalendarContext.id,
          meeting.id,
          provider
        );
        console.log('Notes linked to calendar event:', {
          eventId: activeCalendarContext.id,
          notesId: meeting.id,
        });
      } catch (err) {
        console.error('Failed to link notes to calendar event:', err);
        // Don't fail the recording, this is optional
      }
    }
    
    // Clear the active calendar context
    setActiveCalendarContext(null);
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
  const isGenerating = phase === 'generating_notes';

  return (
    <div className="h-full bg-studio text-slate-ink dark:bg-onyx dark:text-gray-100">
      {/* Meeting Context Preview Modal */}
      {calendarContext && isIdle && (
        <MeetingContextPreview
          meeting={calendarContext}
          onDismiss={() => setCalendarContext(null)}
        />
      )}

      <div className="mx-auto w-full px-4 sm:px-6 py-4 flex flex-col gap-4">
        {/* Greeting + Unified Action Row */}
        <div className="space-y-3">
          {/* Greeting or Recording Title */}
          <div>
            {isIdle ? (
              <h1 className="text-3xl font-medium text-slate-900 dark:text-white">
                {getGreeting()}
              </h1>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isRecording && 'Recording in progress... keep the conversation flowing'}
                  {isPaused && 'Recording paused — resume when ready'}
                </p>
                {recordingTitle && (
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {recordingTitle}
                  </h2>
                )}
              </div>
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
                    disabled={isGenerating}
                    className={`px-4 py-2 bg-[#8B5CF6] text-white font-semibold rounded-lg flex items-center gap-2 transition ${isGenerating ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-95'}`}
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePauseRecording}
                    disabled={isGenerating}
                    className={`px-4 py-2 bg-slate-100 text-slate-ink font-semibold rounded-lg flex items-center gap-2 transition dark:bg-slate-800/80 dark:text-gray-100 ${isGenerating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  disabled={isGenerating}
                  className={`px-4 py-2 bg-red-600 text-white font-semibold rounded-lg flex items-center gap-2 transition ${isGenerating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'}`}
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact audio meters moved into transcript header */}

        {/* Dashboard or meeting content - full height, no scroll */}
        <div className="flex-1 rounded-2xl bg-white/70 dark:bg-graphite/80 border border-white/30 dark:border-white/10 shadow-soft-card backdrop-blur-md overflow-hidden flex flex-col">
          {isRecording || isPaused || isGenerating || phase === 'completed' || phase === 'error' ? (
            <div className="h-full flex flex-col p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {phase === 'completed' ? 'Meeting Complete' : 'Live Transcript'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {phase === 'completed' ? 'Notes generated successfully' : 'Local audio is highlighted in Emerald Mist.'}
                  </p>
                </div>
                {(isRecording || isPaused) && (
                  <div className="flex items-center gap-3">
                    <div className="w-40">
                      <AudioLevelMeter label="Mic" level={audioLevels.mic} />
                    </div>
                    <div className="w-40">
                      <AudioLevelMeter label="System" level={audioLevels.system} />
                    </div>
                  </div>
                )}
              </div>
              {isGenerating ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Generating notes…</span>
                  </div>
                </div>
              ) : phase === 'completed' && completedMeeting ? (
                <div className="flex-1 overflow-y-auto space-y-4">
                  {/* Notes Section */}
                  {completedMeeting.overview && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200/40 dark:border-blue-800/40">
                      <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Overview</h3>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{completedMeeting.overview}</p>
                    </div>
                  )}
                  {completedMeeting.notesMarkdown && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/20 rounded-xl p-4 border border-gray-200/40 dark:border-gray-800/40">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Notes</h3>
                      <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert">
                        {completedMeeting.notesMarkdown}
                      </div>
                    </div>
                  )}
                  {/* Transcript Section */}
                  {liveTranscript.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Transcript</h3>
                      <div className="space-y-3">
                        {liveTranscript.map((segment) => (
                          <div
                            key={segment.id}
                            className={`flex ${segment.source === 'mic' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                segment.source === 'mic'
                                  ? 'bg-gray-900 dark:bg-gray-800 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <p className="text-sm">{segment.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <LiveTranscript segments={liveTranscript} currentPartials={currentPartials} />
                </div>
              )}
              {phase === 'error' && (
                <div className="mt-3 rounded-lg border border-red-300/40 bg-red-50/20 text-red-600 dark:text-red-400 px-3 py-2 text-sm">
                  {errorMessage || 'Notes generation failed.'}
                  <div className="mt-2">
                    <button
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-gray-100 rounded-md text-xs"
                      onClick={async () => {
                        // Load latest meeting list and navigate to transcript view
                        try {
                          const meetingsList = await window.kakarot.meetings.list();
                          const last = meetingsList[0];
                          if (last) {
                            const full = await window.kakarot.meetings.get(last.id);
                            setSelectedMeeting(full);
                            setView('history');
                          }
                        } catch (e) {
                          console.error('Failed to navigate to transcript after error', e);
                        }
                      }}
                    >
                      View Transcript
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <BentoDashboard isRecording={isRecording || isPaused} onStartNotes={handleStartRecording} onSelectTab={handleSelectTab} />
          )}
        </div>
      </div>
    </div>
  );
}
