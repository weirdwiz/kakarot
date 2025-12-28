import React from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from '../hooks/useAudioCapture';
import AudioLevelMeter from './AudioLevelMeter';
import LiveTranscript from './LiveTranscript';
import BentoDashboard from './bento/BentoDashboard';
import AskNotesBar from './AskNotesBar';
import ManualNotesView from './ManualNotesView';
import MeetingContextPreview from './MeetingContextPreview';
import { Square, Pause, Play, Loader2, Calendar as CalendarIcon, Users, Folder } from 'lucide-react';
import { formatDateTime } from '../lib/formatters';
import type { CalendarEvent, AppSettings } from '@shared/types';

interface RecordingViewProps {
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
}

export default function RecordingView({ onSelectTab }: RecordingViewProps) {
  const { recordingState, audioLevels, liveTranscript, currentPartials, clearLiveTranscript, calendarContext, setCalendarContext, activeCalendarContext, setActiveCalendarContext, setLastCompletedNoteId, setSelectedMeeting, setView } = useAppStore();
  const { startCapture, stopCapture, pause, resume } = useAudioCapture();
  const [pillarTab, setPillarTab] = React.useState<'notes' | 'prep' | 'interact'>('notes');
  const [recordingTitle, setRecordingTitle] = React.useState<string>(''); // Title to display during recording
  const [upcomingMeetingId, setUpcomingMeetingId] = React.useState<string | null>(null); // Meeting ID for upcoming notes
  type MeetingPhase = 'recording' | 'processing' | 'completed' | 'error';
  const [phase, setPhase] = React.useState<MeetingPhase>('recording');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [completedMeeting, setCompletedMeeting] = React.useState<any>(null);
  const [aiResponse, setAiResponse] = React.useState<string>('');
  const isIdle = recordingState === 'idle';

  // Forward tab changes to parent if handler provided
  const handleSelectTab = (tab: 'notes' | 'prep' | 'interact') => {
    setPillarTab(tab);
    onSelectTab?.(tab);
  };

  // Initialize meeting when entering manual notes view for upcoming meetings
  React.useEffect(() => {
    if (isIdle && pillarTab === 'notes' && (activeCalendarContext || calendarContext) && !upcomingMeetingId) {
      const meeting = activeCalendarContext || calendarContext;
      if (meeting) {
        // Check if this calendar event already has linked notes; if so, reuse that meeting ID
        window.kakarot.settings.get()
          .then((settings) => {
            const mappings = (settings as AppSettings).calendarEventMappings || {};
            const existing = mappings[meeting.id];
            if (existing?.notesId) {
              setUpcomingMeetingId(existing.notesId);
              console.log('[RecordingView] Using existing notes meeting for upcoming event:', existing.notesId);
              return null; // signal no creation needed
            }
            // Otherwise, create a new meeting entry for upcoming calendar event notes and link it
            return window.kakarot.recording.start({
              calendarEventId: meeting.id,
              calendarEventTitle: meeting.title,
              calendarEventAttendees: meeting.attendees,
              calendarEventStart: meeting.start.toISOString(),
              calendarEventEnd: meeting.end.toISOString(),
              calendarProvider: meeting.provider,
            })
              .then(async (meetingId) => {
                setUpcomingMeetingId(meetingId);
                console.log('[RecordingView] Created meeting for upcoming notes:', meetingId);
                try {
                  await window.kakarot.calendar.linkNotes(meeting.id, meetingId, meeting.provider as 'google' | 'outlook' | 'icloud');
                  console.log('[RecordingView] Linked notes to calendar event:', meeting.id);
                } catch (linkErr) {
                  console.warn('[RecordingView] Failed to link notes to calendar event:', linkErr);
                }
                return meetingId;
              });
          })
          .catch((err) => {
            console.error('[RecordingView] Failed initializing manual notes meeting:', err);
          });
      }
    }
  }, [isIdle, pillarTab, activeCalendarContext, calendarContext, upcomingMeetingId]);

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

  const handleStartRecording = async (calendarEvent?: CalendarEvent) => {
    console.log('[RecordingView] Start button clicked');
    
    // If an event is explicitly passed, use it and set as active calendar context
    // If no event is passed (manual recording), clear any existing calendar context
    if (calendarEvent) {
      console.log('[RecordingView] Setting active calendar context from event:', calendarEvent.title);
      setActiveCalendarContext(calendarEvent);
    } else {
      console.log('[RecordingView] Manual recording - clearing active calendar context');
      setActiveCalendarContext(null);
    }
    
    // Use only the passed event, not any previously stored context
    const contextToUse = calendarEvent || null;
    console.log('[RecordingView] Active calendar context:', contextToUse);
    
    clearLiveTranscript();
    setPhase('recording');
    setCompletedMeeting(null);
    setErrorMessage('');
    
    // Determine the title: prefer calendar context, fallback to "New Meeting"
    const titleToUse = contextToUse?.title || 'New Meeting';
    console.log('[RecordingView] Title to use:', titleToUse, 'from calendar:', !!contextToUse);
    setRecordingTitle(titleToUse);
    
    try {
      console.log('[RecordingView] Calling recording.start()...');
      // Pass active calendar context if available
      const calendarContextData = contextToUse ? {
        calendarEventId: contextToUse.id,
        calendarEventTitle: contextToUse.title,
        calendarEventAttendees: contextToUse.attendees,
        calendarEventStart: contextToUse.start.toISOString(),
        calendarEventEnd: contextToUse.end.toISOString(),
        calendarProvider: contextToUse.provider,
      } : undefined;
      
      console.log('[RecordingView] Calendar context being sent:', calendarContextData);
      await window.kakarot.recording.start(calendarContextData);
      console.log('[RecordingView] recording.start() completed, calling startCapture()...');
      await startCapture();
      console.log('[RecordingView] startCapture() completed');
      setPhase('recording');
      
      // Clear the preview modal now that recording has started
      setCalendarContext(null);
      // Keep activeCalendarContext for the entire recording session
    } catch (error) {
      console.error('[RecordingView] Error starting recording:', error);
    }
  };

  const handleStopRecording = async () => {
    setPhase('processing');
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
    
    // Keep active calendar context until notes render so metadata can be surfaced
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
  const isGenerating = phase === 'processing';

  // Display title: use recordingTitle which is set from calendar context or timestamp at start
  // For completed meetings, prefer the stored title which should be calendar title if it existed
  const displayTitle = (phase === 'completed' && completedMeeting) 
    ? completedMeeting.title 
    : recordingTitle;
  const displayDate = activeCalendarContext?.start || (completedMeeting ? new Date(completedMeeting.createdAt) : new Date());
  const displayAttendees: string[] = (activeCalendarContext?.attendees as any) || completedMeeting?.participants || [];
  const displayLocation = activeCalendarContext?.location;

  return (
    <>
    {/* Show Manual Notes View if viewing notes tab while idle and have calendar context */}
    {isIdle && pillarTab === 'notes' && (activeCalendarContext || calendarContext) ? (
      <ManualNotesView 
        meetingId={upcomingMeetingId || undefined} 
        onSelectTab={handleSelectTab}
        onSaveNotes={() => {
          // After notes are saved, go back to home view
          setPillarTab('notes');
          setActiveCalendarContext(null);
        }}
      />
    ) : (
    <div className="h-full bg-studio text-slate-ink dark:bg-onyx dark:text-gray-100">
      {/* Meeting Context Preview Modal */}
      {calendarContext && isIdle && (
        <MeetingContextPreview
          meeting={calendarContext}
          onDismiss={() => setCalendarContext(null)}
        />
      )}

      <div className="mx-auto w-full px-4 sm:px-6 py-4 flex flex-col gap-4">
        {/* Greeting and quick actions removed per UX request to keep notes view focused */}

        {/* Recording controls and titles - Show when recording, paused, or generating notes */}
        {!isIdle && (
          <div className="space-y-3">
            {/* Recording Title */}
            <div className="space-y-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isRecording && 'Recording in progress... keep the conversation flowing'}
                {isPaused && 'Recording paused — resume when ready'}
              </p>
              {displayTitle && (
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {displayTitle}
                </h2>
              )}
            </div>

            {/* Recording Control Buttons */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/30 dark:border-white/10 bg-transparent backdrop-blur-sm">
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
          </div>
        )}

        {/* Compact audio meters moved into transcript header */}

        {/* Dashboard or meeting content - full height, no scroll */}
        <div className="flex-1 rounded-2xl bg-white/70 dark:bg-graphite/80 border border-white/30 dark:border-white/10 shadow-soft-card backdrop-blur-md overflow-hidden flex flex-col">
          {isRecording || isPaused || isGenerating || phase === 'completed' || phase === 'error' ? (
            <div className="h-full flex flex-col p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {phase === 'completed' ? 'Meeting Notes' : 'Live Transcript'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {phase === 'completed' ? 'Generated from your meeting' : 'Local audio is highlighted in Emerald Mist.'}
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
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#8B5CF6]" />
                    <p className="mt-3 text-base font-medium text-slate-900 dark:text-white">Generating Notes…</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">This usually takes a few seconds.</p>
                  </div>
                </div>
              ) : phase === 'completed' && completedMeeting ? (
                <div className="flex-1 overflow-y-auto pb-32 space-y-6">
                  {/* Title - Large and Primary */}
                  <div className="space-y-4">
                    <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                      {displayTitle || 'Meeting'}
                    </h2>

                    {/* Metadata Blocks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 px-3 py-2.5">
                        <CalendarIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <div className="text-sm text-slate-800 dark:text-slate-200">{formatDateTime(displayDate)}</div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 px-3 py-2.5">
                        <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <div className="text-sm text-slate-800 dark:text-slate-200">
                          {displayAttendees && displayAttendees.length > 0
                            ? displayAttendees.slice(0, 2).join(', ') + (displayAttendees.length > 2 ? ` +${displayAttendees.length - 2}` : '')
                            : 'Add attendees'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 px-3 py-2.5">
                        <Folder className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <div className="text-sm text-slate-800 dark:text-slate-200">
                          {displayLocation || 'No folder'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Overview Card */}
                  {completedMeeting.overview && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                      <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100">
                        {completedMeeting.overview}
                      </p>
                    </div>
                  )}

                  {/* Notes Section */}
                  {completedMeeting.notesMarkdown && (
                    <div className="prose prose-sm max-w-none dark:prose-invert text-slate-800 dark:text-slate-200">
                      <div dangerouslySetInnerHTML={{ __html: (completedMeeting.notesMarkdown as string).replace(/\n/g, '<br/>') }} />
                    </div>
                  )}

                  {/* Transcript Section */}
                  {liveTranscript.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Transcript</h3>
                      <div className="space-y-3">
                        {liveTranscript.map((segment) => (
                          <div
                            key={segment.id}
                            className={`flex ${segment.source === 'mic' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                                segment.source === 'mic'
                                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              <p>{segment.text}</p>
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

      {/* "Ask your notes" bar - only in completed phase */}
      {phase === 'completed' && completedMeeting && (
        <AskNotesBar meeting={completedMeeting} onResponse={setAiResponse} />
      )}
      {/* AI Response Panel - render above ask bar if response exists */}
      {aiResponse && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-19 max-w-2xl w-full max-h-[300px] overflow-y-auto pointer-events-auto">
          <div className="mx-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-soft-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {aiResponse}
                </p>
              </div>
              <button
                onClick={() => setAiResponse('')}
                className="flex-shrink-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </>
  );
}
