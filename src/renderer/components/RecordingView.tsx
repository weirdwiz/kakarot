import React from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from '../hooks/useAudioCapture';
import AudioLevelMeter from './AudioLevelMeter';
import LiveTranscript from './LiveTranscript';
import BentoDashboard from './bento/BentoDashboard';
import AskNotesBar from './AskNotesBar';
import ManualNotesView from './ManualNotesView';
import MeetingContextPreview from './MeetingContextPreview';
import AttendeesList from './AttendeesList';
import SearchPopup from './SearchPopup';
import { Square, Search, Loader2, Calendar as CalendarIcon, Users, Share2, Copy, Check, X, Clock, ChevronDown, Mic } from 'lucide-react';
import { formatMeetingDate } from '../lib/formatters';
import type { TranscriptSegment } from '@shared/types';
import type { CalendarEvent, AppSettings, GeneratedStructuredNotes } from '@shared/types';
import slackLogo from '../assets/slack.png';
import { toast } from '../stores/toastStore';
import { StructuredNotesView } from './StructuredNotesView';

interface RecordingViewProps {
  onSelectTab?: (tab: 'notes' | 'prep') => void;
}

// Transcript grouping constants and utilities (same as LiveTranscript.tsx)
const MERGE_WINDOW_MS = 45000; // 45 seconds
const CONTINUOUS_SPEECH_MS = 2000; // 2 seconds

interface GroupedSegment {
  id: string;
  source: 'mic' | 'system';
  timestamp: number;
  text: string;
  segmentCount: number;
}

function endsWithSentence(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed);
}

function groupTranscriptSegments(segments: TranscriptSegment[]): GroupedSegment[] {
  if (segments.length === 0) return [];

  const groups: GroupedSegment[] = [];
  let currentGroup: GroupedSegment | null = null;

  for (const segment of segments) {
    if (!currentGroup) {
      currentGroup = {
        id: segment.id,
        source: segment.source,
        timestamp: segment.timestamp,
        text: segment.text,
        segmentCount: 1,
      };
      continue;
    }

    const timeSinceLast = segment.timestamp - currentGroup.timestamp;
    const isSameSpeaker = currentGroup.source === segment.source;
    const withinTimeWindow = timeSinceLast < MERGE_WINDOW_MS;
    const isContinuousSpeech = timeSinceLast < CONTINUOUS_SPEECH_MS;
    const previousIncomplete = !endsWithSentence(currentGroup.text);

    const shouldMerge = isSameSpeaker && (isContinuousSpeech || withinTimeWindow || previousIncomplete);

    if (shouldMerge) {
      currentGroup.text += ' ' + segment.text;
      currentGroup.segmentCount++;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: segment.id,
        source: segment.source,
        timestamp: segment.timestamp,
        text: segment.text,
        segmentCount: 1,
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export default function RecordingView({ onSelectTab }: RecordingViewProps) {
  const { recordingState, audioLevels, liveTranscript, currentPartials, clearLiveTranscript, calendarContext, setCalendarContext, activeCalendarContext, setActiveCalendarContext, setLastCompletedNoteId, setSelectedMeeting, setView, currentMeetingId, setCurrentMeetingId, showRecordingHome, setShowRecordingHome, setInitialPrepQuery, setRecordingResult } = useAppStore();
  const { startCapture, stopCapture, pause: pauseCapture, resume: resumeCapture } = useAudioCapture();
  const [pillarTab, setPillarTab] = React.useState<'notes' | 'prep'>('notes');
  const [recordingTitle, setRecordingTitle] = React.useState<string>(''); // Title to display during recording
  const [upcomingMeetingId, setUpcomingMeetingId] = React.useState<string | null>(null); // Meeting ID for upcoming notes
  type MeetingPhase = 'recording' | 'processing' | 'completed' | 'error';
  const [phase, setPhase] = React.useState<MeetingPhase>('recording');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [completedMeeting, setCompletedMeeting] = React.useState<any>(null);
  const [aiResponse, setAiResponse] = React.useState<string>('');
  const [titleInput, setTitleInput] = React.useState<string>('');
  const [isSavingTitle, setIsSavingTitle] = React.useState<boolean>(false);
  const [showSharePopover, setShowSharePopover] = React.useState<boolean>(false);
  const [shareCopied, setShareCopied] = React.useState<boolean>(false);
  const shareRef = React.useRef<HTMLDivElement | null>(null);
  const [showCRMPrompt, setShowCRMPrompt] = React.useState<boolean>(false);
  const [pendingCRMMeetingId, setPendingCRMMeetingId] = React.useState<string | null>(null);
  const [crmProvider, setCRMProvider] = React.useState<'salesforce' | 'hubspot' | null>(null);
  const [isPushingNotes, setIsPushingNotes] = React.useState<boolean>(false);
  const [showManualNotes, setShowManualNotes] = React.useState<boolean>(false);
  const [notes, setNotes] = React.useState<string>('');
  const [showSearchPopup, setShowSearchPopup] = React.useState<boolean>(false);
  const titleContainerRef = React.useRef<HTMLDivElement | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const [titleFontSize, setTitleFontSize] = React.useState<number>(48);
  
  // Slack state
  const [slackToken, setSlackToken] = React.useState<string | null>(null);
  const [slackChannels, setSlackChannels] = React.useState<Array<{ id: string; name: string; isPrivate?: boolean }>>([]);
  const [slackChannelId, setSlackChannelId] = React.useState('');
  const [isSlackConnecting, setIsSlackConnecting] = React.useState(false);
  const [isSlackSending, setIsSlackSending] = React.useState(false);
  const [showSlackOptions, setShowSlackOptions] = React.useState(false);
  
  const [showTimePopover, setShowTimePopover] = React.useState<boolean>(false);
  const [showParticipantsPopover, setShowParticipantsPopover] = React.useState<boolean>(false);
  const [showTranscriptPopover, setShowTranscriptPopover] = React.useState<boolean>(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState<boolean>(true);
  const timeButtonRef = React.useRef<HTMLButtonElement>(null);
  const timePopoverRef = React.useRef<HTMLDivElement>(null);
  const participantsButtonRef = React.useRef<HTMLButtonElement>(null);
  const participantsPopoverRef = React.useRef<HTMLDivElement>(null);
  const transcriptScrollRef = React.useRef<HTMLDivElement>(null);
  const lastScrollTopRef = React.useRef<number>(0);
  const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isIdle = recordingState === 'idle';
  const isRecording = recordingState === 'recording';
  const isPaused = recordingState === 'paused';
  const isGenerating = phase === 'processing';

  const updateTitleFontSize = React.useCallback(() => {
    const container = titleContainerRef.current;
    if (!container) return;

    const availableWidth = container.clientWidth;
    if (!availableWidth) return;

    const text = titleInput?.trim() || 'Untitled Meeting';
    const inputEl = titleInputRef.current;
    const computed = inputEl ? window.getComputedStyle(inputEl) : null;
    const fontFamily = computed?.fontFamily || 'Outfit, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    const fontWeight = computed?.fontWeight || '700';

    const maxSize = 48;
    const minSize = 24;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = `${fontWeight} ${maxSize}px ${fontFamily}`;
    const textWidth = ctx.measureText(text).width;
    const nextSize = textWidth > availableWidth
      ? Math.max(minSize, Math.floor((availableWidth / textWidth) * maxSize))
      : maxSize;

    setTitleFontSize(nextSize);
  }, [titleInput]);

  React.useEffect(() => {
    updateTitleFontSize();
  }, [updateTitleFontSize]);

  React.useEffect(() => {
    const container = titleContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updateTitleFontSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateTitleFontSize]);

  // Track previous recording state to detect pause->resume transitions
  const prevRecordingStateRef = React.useRef<string>(recordingState);

  // Pause/resume audio capture when recording state changes
  React.useEffect(() => {
    const prevState = prevRecordingStateRef.current;
    prevRecordingStateRef.current = recordingState;

    if (recordingState === 'paused') {
      pauseCapture();
    } else if (recordingState === 'recording' && prevState === 'paused') {
      // Only resume if we're coming from a paused state, not from idle (fresh start)
      resumeCapture();
    } else if (recordingState === 'idle' && prevState !== 'idle') {
      // Fully stop capture when transitioning to idle from ANY state
      // This covers recording->idle, paused->idle, AND processing->idle as a safety net
      stopCapture();
    }
  }, [recordingState, pauseCapture, resumeCapture, stopCapture]);

  // Forward tab changes to parent if handler provided
  const handleSelectTab = (tab: 'notes' | 'prep') => {
    setPillarTab(tab);
    onSelectTab?.(tab);
  };

  // Load existing manual notes when showing split view
  React.useEffect(() => {
    const loadNotes = async () => {
      if (showManualNotes && upcomingMeetingId) {
        try {
          const meetingData = await window.kakarot.meetings.get(upcomingMeetingId);
          if (meetingData?.noteEntries) {
            const manualNotes = meetingData.noteEntries
              .filter(entry => entry.type === 'manual')
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            if (manualNotes.length > 0) {
              setNotes(manualNotes[0].content);
            }
          }
        } catch (error) {
          console.error('Failed to load existing notes:', error);
        }
      }
    };
    
    loadNotes();
  }, [showManualNotes, upcomingMeetingId]);

  // Autosave notes when typing
  React.useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    if (notes.trim() && upcomingMeetingId && showManualNotes) {
      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.kakarot.meetings.saveManualNotes(upcomingMeetingId, notes);
        } catch (error) {
          console.error('Failed to autosave notes:', error);
        }
      }, 1000);
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [notes, upcomingMeetingId, showManualNotes]);

  // Initialize meeting when entering manual notes view for upcoming meetings
  // IMPORTANT: Only create meeting when explicitly viewing manual notes (calendarContext),
  // NOT when starting recording from calendar (activeCalendarContext)
  React.useEffect(() => {
    if (isIdle && pillarTab === 'notes' && calendarContext && !activeCalendarContext && !upcomingMeetingId) {
      const meeting = calendarContext;
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
            // Create a new meeting entry for upcoming calendar event notes (without starting recording)
            const attendeeEmails = meeting.attendees?.map((a: any) => typeof a === 'string' ? a : a.email) || [];
            return window.kakarot.meetings.createDismissed(meeting.title, attendeeEmails)
              .then(async (meetingId: string) => {
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

  const [userFirstName, setUserFirstName] = React.useState('User');

  // Fetch user name from settings
  React.useEffect(() => {
    window.kakarot.settings.get().then((settings) => {
      if (settings.userProfile?.name) {
        const firstName = settings.userProfile.name.split(' ')[0];
        setUserFirstName(firstName);
      }
    });
  }, []);

  // Auto-scroll transcript when new messages arrive
  React.useEffect(() => {
    if (isAutoScrollEnabled && transcriptScrollRef.current && showTranscriptPopover) {
      transcriptScrollRef.current.scrollTo({
        top: transcriptScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [liveTranscript, currentPartials, isAutoScrollEnabled, showTranscriptPopover]);

  // Hook into meeting notes completion event
  React.useEffect(() => {
    const unsubscribe = window.kakarot.recording.onNotesComplete?.((data: { meetingId: string; title: string; overview: string }) => {
      console.log('[RecordingView] Notes completed:', data);
      // Fetch the full meeting and display inline
      window.kakarot.meetings.get(data.meetingId)
        .then((meeting) => {
          if (meeting) {
            const hasNotes = Boolean((meeting as any).notes || (meeting as any).notesMarkdown || (meeting as any).overview);
            if (hasNotes) {
              setLastCompletedNoteId(data.meetingId);
              setCompletedMeeting(meeting);
              setPhase('completed');
              setRecordingResult('completed');
              console.log('[RecordingView] Notes generated and displayed inline:', data.meetingId);
            } else {
              setPhase('error');
              setErrorMessage('Notes generation failed. You can still view the transcript.');
              setRecordingResult('error');
              setActiveCalendarContext(null); // Clear to prevent Manual Notes view from showing
              console.warn('[RecordingView] Notes generation appears to have failed.');
            }
          }
        })
        .catch((err) => {
          setPhase('error');
          setErrorMessage('Something went wrong loading your meeting.');
          setRecordingResult('error');
          setActiveCalendarContext(null); // Clear to prevent Manual Notes view from showing
          console.error('[RecordingView] Failed to load meeting after notes completion:', err);
        });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setLastCompletedNoteId]);

  React.useEffect(() => {
    const unsubscribe = window.kakarot.recording.onAutoStop?.(() => {
      console.log('[RecordingView] Auto stop UI flow triggered');
      setPhase('processing');
      setErrorMessage('');
      stopCapture().catch((err) => {
        console.warn('[RecordingView] stopCapture failed during auto stop', err);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [stopCapture]);

  // Hook into native notification click event for starting recording
  React.useEffect(() => {
    console.log('[RecordingView] Setting up notification listener');
    const unsubscribe = window.kakarot.recording.onNotificationStartRecording?.((context) => {
      console.log('[RecordingView] Notification triggered recording start with context:', context);
      // Convert notification context to CalendarEvent format
      const calendarEvent: CalendarEvent = {
        id: context.calendarEventId,
        title: context.calendarEventTitle,
        attendees: context.calendarEventAttendees || [],
        start: new Date(context.calendarEventStart),
        end: new Date(context.calendarEventEnd),
        location: '', // Will be set from the meeting link
        provider: context.calendarProvider as 'google' | 'outlook' | 'icloud',
      };
      console.log('[RecordingView] Calling handleStartRecording with:', calendarEvent);
      // Start recording with the calendar event context from the notification
      handleStartRecording(calendarEvent);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return `Good Morning, ${userFirstName}`;
    if (hour >= 12 && hour < 22) return `Good Afternoon, ${userFirstName}`;
    return `Good Evening, ${userFirstName}`;
  };

  const handlePrepMeeting = async (meeting: CalendarEvent) => {
    // Get user's email from settings to exclude from attendees list
    const settings = await window.kakarot.settings.get() as AppSettings;
    const userEmail = settings.userProfile?.email?.toLowerCase();

    // Format attendee names for the prep query, excluding the signed-in user
    const attendeeNamesList = meeting.attendees
      ?.filter(a => {
        const email = (typeof a === 'string' ? a : a.email || '').toLowerCase();
        return email && email !== userEmail;
      })
      .map(a => typeof a === 'string' ? a : a.name || a.email)
      .filter(Boolean) ?? [];

    if (attendeeNamesList.length > 0) {
      const names = attendeeNamesList.join(', ');
      const prepQuery = `I have a meeting with ${names}, help me prep.`;
      setInitialPrepQuery(prepQuery);
    } else {
      setInitialPrepQuery(null);
    }

    handleSelectTab('prep');
  };

  const handleTranscribeNow = (meeting: CalendarEvent) => {
    // Start recording with the calendar event context
    handleStartRecording(meeting);
  };

  const handleStartRecording = async (calendarEvent?: CalendarEvent) => {
    console.log('[RecordingView] Start button clicked');
    
    // If an event is explicitly passed, use it and set as active calendar context
    // If no event is passed (manual recording), clear any existing calendar context
    if (calendarEvent) {
      console.log('[RecordingView] Setting active calendar context from event:', calendarEvent.title);
      setActiveCalendarContext(calendarEvent);
      // Don't set showManualNotes here - it's only for pre-meeting manual notes, not during recording
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
    setRecordingResult(null);
    
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
      const meetingId = await window.kakarot.recording.start(calendarContextData);
      setCurrentMeetingId(meetingId);
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
    // If paused, resume instead
    if (recordingState === 'paused') {
      console.log('Resuming transcription');
      await window.kakarot.recording.resume();
      return;
    }

    // Proceed with stop regardless of transcript length
    // Backend will handle the case of insufficient transcript gracefully
    setPhase('processing');
    setErrorMessage('');
    setRecordingResult(null);
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
    
    // Check CRM settings and trigger prompt if needed
    try {
      const settings = await window.kakarot.settings.get() as AppSettings;
      if (settings.crmConnections) {
        // Find first connected CRM provider
        const connectedProvider = (Object.keys(settings.crmConnections) as Array<'salesforce' | 'hubspot'>).find(
          (provider) => settings.crmConnections?.[provider]?.accessToken
        );
        
        if (connectedProvider && meeting) {
          if (settings.crmNotesBehavior === 'always') {
            // Auto-send without prompting
            try {
              await window.kakarot.crm.pushNotes(meeting.id);
              console.log('[RecordingView] Notes automatically pushed to CRM:', connectedProvider);
            } catch (err) {
              console.error('[RecordingView] Failed to auto-push notes to CRM:', err);
            }
          } else if (settings.crmNotesBehavior === 'ask') {
            // Show prompt asking user
            setPendingCRMMeetingId(meeting.id);
            setCRMProvider(connectedProvider);
            setShowCRMPrompt(true);
          }
        }
      }
    } catch (err) {
      console.error('[RecordingView] Failed to check CRM settings:', err);
    }

    // Keep active calendar context until notes render so metadata can be surfaced
  };

  const isMeetingNotesScreen = phase === 'completed' && Boolean(completedMeeting);
  const showBentoWhileLive = showRecordingHome && (isRecording || isPaused || isGenerating);
  const showHomeHero = (isIdle || showBentoWhileLive) && !isMeetingNotesScreen;
  const isRecordingLayout = (isRecording || isPaused) && !isGenerating;

  // Display title: use recordingTitle which is set from calendar context or timestamp at start
  // For completed meetings, prefer the stored title which should be calendar title if it existed
  const displayTitle = (phase === 'completed' && completedMeeting) 
    ? completedMeeting.title 
    : recordingTitle;
  const displayDate = activeCalendarContext?.start || (completedMeeting ? new Date(completedMeeting.createdAt) : new Date());
  const displayAttendees: string[] = (
    activeCalendarContext?.attendees?.map((a: any) => 
      typeof a === 'string' ? a : a.email
    ) || completedMeeting?.attendeeEmails || completedMeeting?.participants || []
  );
  const displayLocation = activeCalendarContext?.location;

  React.useEffect(() => {
    setTitleInput(displayTitle || '');
  }, [displayTitle]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShowSharePopover(false);
      }
      if (
        timePopoverRef.current && !timePopoverRef.current.contains(event.target as Node) &&
        timeButtonRef.current && !timeButtonRef.current.contains(event.target as Node)
      ) {
        setShowTimePopover(false);
      }
      if (
        participantsPopoverRef.current && !participantsPopoverRef.current.contains(event.target as Node) &&
        participantsButtonRef.current && !participantsButtonRef.current.contains(event.target as Node)
      ) {
        setShowParticipantsPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const persistTitle = async (nextTitleRaw: string) => {
    const nextTitle = nextTitleRaw.trim() || 'Untitled Meeting';
    setTitleInput(nextTitle);
    setRecordingTitle(nextTitle);
    setCompletedMeeting((prev: any) => (prev ? { ...prev, title: nextTitle } : prev));

    const targetMeetingId = completedMeeting?.id || currentMeetingId || upcomingMeetingId;
    if (!targetMeetingId) return;

    setIsSavingTitle(true);
    try {
      await window.kakarot.meetings.updateTitle(targetMeetingId, nextTitle);
    } catch (err) {
      console.error('Failed to update meeting title', err);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const shareLink = completedMeeting ? `kakarot://meeting/${completedMeeting.id}` : '';

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy share link', err);
    }
  };

  const handleCRMPromptYes = async () => {
    if (!pendingCRMMeetingId) return;
    
    setIsPushingNotes(true);
    try {
      await window.kakarot.crm.pushNotes(pendingCRMMeetingId);
      console.log('[RecordingView] Notes pushed to CRM successfully');
    } catch (err) {
      console.error('[RecordingView] Failed to push notes to CRM:', err);
    } finally {
      setShowCRMPrompt(false);
      setPendingCRMMeetingId(null);
      setCRMProvider(null);
      setIsPushingNotes(false);
    }
  };

  const handleCRMPromptNo = () => {
    setShowCRMPrompt(false);
    setPendingCRMMeetingId(null);
    setCRMProvider(null);
  };

  const handleSlack = async () => {
    if (!completedMeeting) return;

    if (!slackToken) {
      try {
        setIsSlackConnecting(true);
        const result = await window.kakarot.slack.connect();
        setSlackToken(result.accessToken);
        const channelList = await window.kakarot.slack.getChannels(result.accessToken);
        setSlackChannels(channelList);
        setShowSlackOptions(true);
      } catch (err) {
        console.error('Failed to connect to Slack:', err);
        toast.error('Failed to connect to Slack');
      } finally {
        setIsSlackConnecting(false);
      }
    } else {
      setShowSlackOptions(true);
    }
  };

  const handleSlackSend = async () => {
    if (!slackToken || !slackChannelId || !completedMeeting) return;

    setIsSlackSending(true);
    try {
      const notesContent = completedMeeting.notesMarkdown || completedMeeting.overview || 'Meeting notes';
      await window.kakarot.slack.sendNote(slackToken, slackChannelId, `📝 *${completedMeeting.title}*\n\n${notesContent}`);
      toast.success('Notes sent to Slack!');
      setShowSlackOptions(false);
      setShowSharePopover(false);
    } catch (err) {
      console.error('Failed to send to Slack:', err);
      toast.error('Failed to send notes to Slack');
    } finally {
      setIsSlackSending(false);
    }
  };

  return (
    <>
    {/* Show Manual Notes View ONLY when explicitly clicking on upcoming meeting (calendarContext), never as fallback after recording */}
    {isIdle && pillarTab === 'notes' && calendarContext && !activeCalendarContext && phase !== 'completed' && phase !== 'error' && !(completedMeeting?.notesMarkdown || completedMeeting?.overview) ? (
      <ManualNotesView 
        meetingId={upcomingMeetingId || undefined} 
        onSelectTab={handleSelectTab}
        onSaveNotes={() => {
          // After notes are saved, go back to home view
          setPillarTab('notes');
          setActiveCalendarContext(null);
        }}
        onStartRecording={() => {
          // Start recording from manual notes view
          const calEvent = activeCalendarContext || calendarContext;
          if (calEvent) {
            handleStartRecording(calEvent);
          }
        }}
      />
    ) : (
    <div className="flex-1 min-h-0 text-slate-ink dark:text-[#F0EBE3] flex flex-col">
      {/* Meeting Context Preview Modal */}
      {calendarContext && isIdle && (
        <MeetingContextPreview
          meeting={calendarContext}
          onDismiss={() => setCalendarContext(null)}
          onPrep={handlePrepMeeting}
          onTranscribeNow={handleTranscribeNow}
        />
      )}

      <div className="w-full flex flex-col flex-1 min-h-0">
        {/* Greeting + Unified Action Row - Only show when truly idle (not viewing completed notes) */}
        {showHomeHero && (
          <div className="flex-shrink-0 mx-auto w-full max-w-2xl px-4 sm:px-6 py-4 space-y-3 animate-view-enter">
            {/* Greeting */}
            <div>
              <h1 className="text-4xl font-display text-slate-900 dark:text-[#F0EBE3]">
                {getGreeting()}
              </h1>
            </div>

            {/* Unified Action Row (Search + Take Notes) */}
            <div className="flex items-center gap-2">
              {/* Search Bar - 75% width */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5750]" />
                <input
                  type="text"
                  placeholder="Search meetings or notes"
                  className="w-full pl-10 pr-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl text-sm text-[#F0EBE3] placeholder:text-[#5C5750] focus:outline-none focus:ring-1 focus:ring-[#C17F3E]/30 focus:border-[#C17F3E]/20 transition cursor-pointer"
                  onClick={() => setShowSearchPopup(true)}
                  onFocus={() => setShowSearchPopup(true)}
                  readOnly
                />
              </div>

              {/* Take Notes Button - 25% width, compact size */}
              <button
                onClick={() => handleStartRecording()}
                disabled={isRecording || isPaused || isGenerating}
                className="px-4 py-2 bg-[#C17F3E] text-[#0C0C0C] font-semibold rounded-xl flex items-center gap-1.5 shadow-copper-soft transition-all duration-200 hover:bg-[#D4923F] hover:shadow-copper-glow active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 text-sm"
              >
                <Mic className="w-3.5 h-3.5" />
                Start Recording
              </button>
            </div>
          </div>
        )}

        {/* Dashboard or meeting content */}
        <div className={`w-full flex justify-center flex-1 min-h-0 ${isRecordingLayout ? 'px-0' : 'px-4 sm:px-6'}`}>
          <div className={`w-full ${isRecordingLayout ? 'max-w-none' : 'max-w-2xl'} flex flex-col flex-1 min-h-0`}>
            {showBentoWhileLive ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Amber banner with back button */}
                <div className="flex-shrink-0 pt-4 sm:pt-6 pb-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200/60 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-900/30 text-amber-800 dark:text-amber-100">
                    <div className="text-sm font-medium">{recordingTitle || 'Meeting'} - Transcription in Progress</div>
                    <button
                      className="text-xs px-3 py-1.5 rounded-md bg-[#0C0C0C] text-white hover:bg-[#1E1E1E]"
                      onClick={() => setShowRecordingHome(false)}
                    >
                      Back to the meeting
                    </button>
                  </div>
                </div>
                {/* BentoDashboard below the banner */}
                <div className="flex-1 min-h-0 overflow-auto pb-4 sm:pb-6">
                  <BentoDashboard isRecording={isRecording || isPaused} hideCompactBarWhenNoEvents={true} onStartNotes={handleStartRecording} onSelectTab={handleSelectTab} />
                </div>
              </div>
            ) : isRecording || isPaused || isGenerating || phase === 'completed' || phase === 'error' ? (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Recording layout */}
                {(isRecording || isPaused) && !isGenerating ? (
                  <div className="relative flex-1 min-h-0 flex flex-col rounded-2xl bg-gradient-to-br from-[#141414] via-[#0C0C0C] to-[#080808] shadow-[0_20px_70px_rgba(0,0,0,0.65)] p-6 sm:p-7 overflow-hidden border border-[#1E1E1E] animate-modal-in">
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(193,127,62,0.08),transparent_45%),radial-gradient(circle_at_bottom,rgba(240,235,227,0.03),transparent_40%)]" />
                    <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_-1px_20px_rgba(0,0,0,0.45)]" />
                    <div className="relative flex-1 min-h-0 flex flex-col">
                      {/* Recording Header */}
                      <div className="flex-shrink-0 mb-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-col gap-3 flex-1">
                            {/* Editable title */}
                            <input
                              value={titleInput}
                              onChange={(e) => setTitleInput(e.target.value)}
                              onBlur={() => persistTitle(titleInput)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="text-2xl font-semibold text-white bg-transparent border-b border-transparent focus:border-[#C17F3E] focus:outline-none truncate max-w-[420px]"
                              placeholder="Untitled Meeting"
                            />
                            <div className="flex items-center gap-2">
                              {/* Transcribing indicator */}
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#C17F3E]/10 text-[#D4923F] border border-[#C17F3E]/20 shadow-[0_0_20px_rgba(193,127,62,0.15)]">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C17F3E] opacity-60"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C17F3E]"></span>
                                </span>
                                <span>{isRecording ? 'Transcribing' : 'Paused'}</span>
                              </div>
                              {isSavingTitle && <Loader2 className="w-4 h-4 animate-spin text-[#C17F3E]" />}
                            </div>
                          </div>
                          {/* Meta chips */}
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <button
                                ref={timeButtonRef}
                                onClick={() => setShowTimePopover(!showTimePopover)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>{displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </button>
                              {showTimePopover && (
                                <div
                                  ref={timePopoverRef}
                                  className="absolute top-full right-0 mt-2 bg-[#0C0C0C] rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden min-w-max animate-popover-in"
                                >
                                  <div className="p-3 border-b border-white/10 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white">Meeting Time</h3>
                                    <button
                                      onClick={() => setShowTimePopover(false)}
                                      className="p-1 text-slate-400 hover:text-slate-200 transition rounded hover:bg-white/5"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div>
                                      <p className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">Date</p>
                                      <p className="text-xs text-white">{displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">Time</p>
                                      <p className="text-xs text-white">{displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {activeCalendarContext && displayAttendees.length > 0 && (
                              <div className="relative">
                                <button
                                  ref={participantsButtonRef}
                                  onClick={() => setShowParticipantsPopover(!showParticipantsPopover)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{displayAttendees.length}</span>
                                </button>
                                {showParticipantsPopover && (
                                  <div
                                    ref={participantsPopoverRef}
                                    className="absolute top-full right-0 mt-2 bg-[#0C0C0C] rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden min-w-[280px] animate-popover-in"
                                  >
                                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                                      <h3 className="text-sm font-semibold text-white">Participants</h3>
                                      <button
                                        onClick={() => setShowParticipantsPopover(false)}
                                        className="p-1 text-slate-400 hover:text-slate-200 transition rounded hover:bg-white/5"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="p-3 max-h-[200px] overflow-y-auto">
                                      <div className="space-y-2">
                                        {displayAttendees.map((email, idx) => (
                                          <div key={idx} className="flex items-center gap-2 text-xs">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C17F3E] to-[#C17F3E] flex items-center justify-center text-white font-semibold text-[10px]">
                                              {email.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-slate-300 truncate">{email}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Full Notes Panel */}
                      <div className="flex-1 min-h-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                          <div>
                            <h3 className="text-xs uppercase tracking-[0.2em] font-medium text-[#9C9690]">Your Notes</h3>
                            <p className="text-xs text-[#5C5750] mt-1">Capture action items, decisions, and next steps.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-28">
                              <AudioLevelMeter label="Mic" level={audioLevels.mic} />
                            </div>
                            <div className="w-28">
                              <AudioLevelMeter label="System" level={audioLevels.system} />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Take notes during your meeting..."
                            className="w-full h-full resize-none bg-transparent text-base text-slate-100 placeholder-slate-500 focus:outline-none leading-relaxed overflow-auto"
                          />
                        </div>
                      </div>

                      {/* Bottom Controls */}
                      <div className="flex-shrink-0 mt-3 flex items-center justify-end gap-2">
                        {recordingState === 'paused' && (
                          <button
                            onClick={async () => {
                              await window.kakarot.recording.discard();
                              setPhase('recording');
                              clearLiveTranscript();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700/80 text-white text-xs font-medium hover:bg-red-600/80 transition"
                          >
                            <X className="w-3 h-3" />
                            Discard
                          </button>
                        )}
                        <button
                          onClick={handleStopRecording}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.35)] active:scale-[0.96] ${
                            recordingState === 'paused'
                              ? 'bg-white/10 text-slate-100 border border-white/10 hover:bg-white/15'
                              : 'bg-red-600/80 text-white hover:bg-red-600'
                          }`}
                        >
                          <Square className="w-3.5 h-3.5" />
                          {recordingState === 'paused' ? 'Resume Transcribing' : 'Stop Transcribing'}
                        </button>
                      </div>

                      {/* Live Transcription Capsule - Inside the card */}
                      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
                        <button
                          onClick={() => setShowTranscriptPopover((open) => !open)}
                          className={`flex items-center gap-2.5 rounded-full px-5 py-3 shadow-2xl transition-all duration-200 active:scale-[0.96] ${
                            showTranscriptPopover
                              ? 'bg-[#C17F3E] text-[#0C0C0C] shadow-copper-glow'
                              : 'bg-[#161616] border border-[#2A2A2A] text-[#9C9690] hover:text-[#F0EBE3] hover:border-[#3A3A3A] hover:shadow-elevated'
                          }`}
                          aria-label="Toggle live transcript"
                        >
                          <Mic className="w-4 h-4" />
                          <span className="text-sm font-medium">Live Transcription</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col flex-1 min-h-0 gap-4 p-4 sm:p-6">
                    <div className="mb-4 flex items-center justify-between flex-shrink-0">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {phase === 'completed' ? 'Meeting Notes' : 'Recording'}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {phase === 'completed' ? 'Generated from your meeting' : 'Processing your recording...'}
                        </p>
                      </div>
                      {phase === 'completed' && completedMeeting ? (
                        <div className="relative" ref={shareRef}>
                          <button
                            onClick={() => setShowSharePopover((prev) => !prev)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/30 dark:border-white/10 bg-white/70 dark:bg-[#161616] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-[#2A2A2A] transition"
                          >
                            <Share2 className="w-4 h-4" />
                            Share
                          </button>
                          {showSharePopover && (
                            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#161616] shadow-soft-card p-3 space-y-2 animate-popover-in">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Share your meeting notes</p>
                              <button
                                onClick={handleCopyShareLink}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-[#1E1E1E] dark:bg-[#2A2A2A] text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-[#2A2A2A] dark:hover:bg-[#C17F3E] transition"
                              >
                                <span className="flex items-center gap-2">
                                  {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  {shareCopied ? 'Copied!' : 'Copy share link'}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Link</span>
                              </button>
                              <button
                                onClick={handleSlack}
                                disabled={isSlackConnecting}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-[#1E1E1E] dark:bg-[#2A2A2A] text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-[#2A2A2A] dark:hover:bg-[#C17F3E] transition disabled:opacity-50"
                              >
                                <span className="flex items-center gap-2">
                                  <img src={slackLogo} alt="Slack" className="w-4 h-4" />
                                  {isSlackConnecting ? 'Connecting...' : 'Send to Slack'}
                                </span>
                              </button>
                              {showSlackOptions && (
                                <div className="pt-2 border-t border-slate-200 dark:border-[#2A2A2A] space-y-2">
                                  <select
                                    value={slackChannelId}
                                    onChange={(e) => setSlackChannelId(e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm rounded-md bg-[#1E1E1E] dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] text-slate-800 dark:text-slate-100"
                                  >
                                    <option value="">Select channel...</option>
                                    {slackChannels.map((channel) => (
                                      <option key={channel.id} value={channel.id}>
                                        {channel.isPrivate ? '🔒' : '#'} {channel.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={handleSlackSend}
                                    disabled={!slackChannelId || isSlackSending}
                                    className="w-full px-3 py-1.5 rounded-md bg-[#C17F3E] hover:bg-[#D4923F] text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isSlackSending ? 'Sending...' : 'Send'}
                                  </button>
                                </div>
                              )}
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all leading-tight bg-[#1E1E1E] dark:bg-[#1E1E1E] rounded-md px-2 py-1">{shareLink}</p>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {isGenerating ? (
                      <div className="flex-1 flex items-center justify-center animate-fade-in">
                        <div className="text-center">
                          <div className="relative w-14 h-14 mx-auto mb-4">
                            <div className="absolute inset-0 rounded-full border-2 border-[#2A2A2A]" />
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#C17F3E] animate-spin" />
                            <div className="absolute inset-2 rounded-full bg-[#C17F3E]/10 animate-glow-pulse" />
                          </div>
                          <p className="text-base font-medium text-white">Generating Notes</p>
                          <p className="text-sm text-slate-400 mt-1">Processing your conversation</p>
                        </div>
                      </div>
                    ) : phase === 'completed' && completedMeeting ? (
                      <div className="flex-1 overflow-y-auto pb-32 space-y-6 animate-view-enter">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 min-w-0" ref={titleContainerRef}>
                            <input
                              ref={titleInputRef}
                              value={titleInput}
                              onChange={(e) => setTitleInput(e.target.value)}
                              onBlur={() => persistTitle(titleInput)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              style={{ fontSize: `${titleFontSize}px` }}
                              className="flex-1 min-w-0 w-full font-bold text-slate-900 dark:text-white leading-tight bg-transparent border-b border-transparent focus:border-[#F0EBE3] focus:outline-none"
                              placeholder="Untitled Meeting"
                            />
                            {isSavingTitle && <Loader2 className="w-5 h-5 animate-spin text-[#F0EBE3]" />}
                          </div>

                          <div className="flex gap-3 overflow-visible">
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#2A2A2A] bg-[#1E1E1E]/80 dark:bg-[#1E1E1E] px-3 py-1.5">
                              <CalendarIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              <div className="text-sm text-slate-800 dark:text-slate-200">{formatMeetingDate(displayDate)}</div>
                            </div>

                            {displayAttendees && displayAttendees.length > 0 ? (
                              <div className="overflow-visible">
                                <AttendeesList attendeeEmails={displayAttendees} />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#2A2A2A] bg-[#1E1E1E]/80 dark:bg-[#1E1E1E] px-3 py-1.5">
                                <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <div className="text-sm text-slate-800 dark:text-slate-200">Add attendees</div>
                              </div>
                            )}

                          </div>
                        </div>

                        {completedMeeting.overview && (
                          <div className="bg-[#1E1E1E] dark:bg-[#1E1E1E] rounded-xl p-5 border border-slate-200 dark:border-[#2A2A2A]">
                            <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100">{completedMeeting.overview}</p>
                          </div>
                        )}

                        {/* Structured Notes View - prefer when available */}
                        {completedMeeting.notes && typeof completedMeeting.notes === 'object' &&
                         (completedMeeting.notes as GeneratedStructuredNotes).topics?.length > 0 ? (
                          <div className="bg-[#1E1E1E] dark:bg-[#1E1E1E] rounded-xl p-5 border border-slate-200 dark:border-[#2A2A2A]">
                            <StructuredNotesView
                              notes={completedMeeting.notes as GeneratedStructuredNotes}
                              meetingId={completedMeeting.id}
                            />
                          </div>
                        ) : completedMeeting.notesMarkdown ? (
                          <div className="prose prose-lg max-w-none dark:prose-invert text-slate-800 dark:text-slate-200">
                            <div dangerouslySetInnerHTML={{ __html: (completedMeeting.notesMarkdown as string).replace(/\n/g, '<br/>') }} />
                          </div>
                        ) : null}

                        {liveTranscript.length > 0 && (
                          <div className="border-t border-slate-200 dark:border-[#2A2A2A] pt-6">
                            <h3 className="text-lg font-medium text-[#F0EBE3] mb-4">Transcript</h3>
                            <div className="space-y-3">
                              {liveTranscript.map((segment) => (
                                <div key={segment.id} className={`flex ${segment.source === 'mic' ? 'justify-end' : 'justify-start'}`}>
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                                      segment.source === 'mic'
                                        ? 'bg-[#C17F3E]/15 text-[#F0EBE3] border border-[#C17F3E]/10'
                                        : 'bg-[#1E1E1E] text-[#9C9690] border border-[#2A2A2A]'
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
                    ) : null}

                    {phase === 'error' && (
                      <div className="mt-3 rounded-lg border border-red-300/40 bg-red-50/20 text-red-600 dark:text-red-400 px-3 py-2 text-sm">
                        {errorMessage || 'Notes generation failed.'}
                        <div className="mt-2">
                          <button
                            className="px-3 py-1.5 bg-[#2A2A2A] dark:bg-[#2A2A2A] text-slate-900 dark:text-[#F0EBE3] rounded-md text-xs"
                            onClick={async () => {
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
                )}
              </div>
            ) : (
              <BentoDashboard isRecording={isRecording || isPaused} onStartNotes={handleStartRecording} onSelectTab={handleSelectTab} />
            )}
          </div>

        </div>
      </div>

      {/* Transcript Popover - Fixed position, triggered by capsule inside the card */}
      {(isRecording || isPaused) && !isGenerating && showTranscriptPopover && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[480px] max-h-[450px] rounded-2xl border border-[#2A2A2A] bg-[#0C0C0C] shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-popover-in-up">
          {/* Popover Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C17F3E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C17F3E]"></span>
                </span>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live Transcript</span>
              </div>
            </div>
            <button
              onClick={() => setShowTranscriptPopover(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition"
              aria-label="Close transcript"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Transcript Content */}
          <div
            ref={transcriptScrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;

              // If user scrolled up (scrollTop decreased), disable auto-scroll
              if (target.scrollTop < lastScrollTopRef.current && !isAtBottom) {
                setIsAutoScrollEnabled(false);
              }

              // If user scrolled to bottom, re-enable auto-scroll
              if (isAtBottom) {
                setIsAutoScrollEnabled(true);
              }

              lastScrollTopRef.current = target.scrollTop;
            }}
          >
            {liveTranscript.length === 0 && !currentPartials.mic && !currentPartials.system ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mic className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">Waiting for speech...</p>
                <p className="text-xs text-slate-600 mt-1">Start talking and the transcript will appear here</p>
              </div>
            ) : (
              <>
                {groupTranscriptSegments(liveTranscript).map((group) => (
                  <div
                    key={group.id}
                    className={`flex ${group.source === 'mic' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        group.source === 'mic'
                          ? 'bg-[#C17F3E]/20 text-[#F0EBE3] border border-[#C17F3E]/15 rounded-br-md'
                          : 'bg-[#1E1E1E] text-[#9C9690] border border-[#2A2A2A] rounded-bl-md'
                      }`}
                    >
                      <p className="leading-relaxed">{group.text}</p>
                    </div>
                  </div>
                ))}
                {/* System partial */}
                {currentPartials.system && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm opacity-50 bg-[#1E1E1E] text-[#9C9690] border border-[#2A2A2A] rounded-bl-md">
                      <p className="leading-relaxed">{currentPartials.system.text}</p>
                    </div>
                  </div>
                )}
                {/* Mic partial */}
                {currentPartials.mic && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm opacity-50 bg-[#C17F3E]/20 text-[#F0EBE3] border border-[#C17F3E]/15 rounded-br-md">
                      <p className="leading-relaxed">{currentPartials.mic.text}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scroll to bottom button */}
          {!isAutoScrollEnabled && liveTranscript.length > 0 && (
            <button
              onClick={() => {
                setIsAutoScrollEnabled(true);
                if (transcriptScrollRef.current) {
                  transcriptScrollRef.current.scrollTo({
                    top: transcriptScrollRef.current.scrollHeight,
                    behavior: 'smooth'
                  });
                }
              }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-[#C17F3E] text-[#0C0C0C] text-xs font-medium shadow-lg hover:bg-[#D4923F] transition"
            >
              <ChevronDown className="w-4 h-4" />
              New messages
            </button>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 px-4 py-2.5 border-t border-[#1E1E1E] bg-[#0C0C0C] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#2A2A2A] border border-[#3A3A3A]"></div>
              <span className="text-xs text-[#5C5750]">System Audio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#C17F3E]/30 border border-[#C17F3E]/20"></div>
              <span className="text-xs text-[#5C5750]">Your Mic</span>
            </div>
          </div>
        </div>
      )}

      {/* "Ask your notes" bar - only in completed phase */}
      {phase === 'completed' && completedMeeting && (
        <AskNotesBar meeting={completedMeeting} onResponse={setAiResponse} />
      )}
      {/* AI Response Panel - render above ask bar if response exists */}
      {aiResponse && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-19 max-w-2xl w-full max-h-[300px] overflow-y-auto pointer-events-auto">
          <div className="mx-4 p-4 bg-[#1E1E1E] dark:bg-[#1E1E1E] rounded-xl border border-slate-200 dark:border-[#2A2A2A] shadow-soft-card">
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

      {/* CRM Meeting Complete Prompt Modal */}
      {showCRMPrompt && crmProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-in">
          <div className="bg-white dark:bg-[#161616] rounded-xl shadow-lg max-w-sm w-full border border-slate-200 dark:border-[#2A2A2A] animate-modal-in">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Send to {crmProvider === 'salesforce' ? 'Salesforce' : 'HubSpot'}?
                </h3>
                <button
                  onClick={handleCRMPromptNo}
                  disabled={isPushingNotes}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                Would you like to send these meeting notes to {crmProvider === 'salesforce' ? 'Salesforce' : 'HubSpot'}? 
                {crmProvider === 'salesforce' ? ' Notes will be added as tasks.' : ' Notes will be created as contact notes.'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleCRMPromptNo}
                  disabled={isPushingNotes}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-slate-200 font-medium hover:bg-[#1E1E1E] dark:hover:bg-[#2A2A2A]/50 disabled:opacity-50 transition"
                >
                  No
                </button>
                <button
                  onClick={handleCRMPromptYes}
                  disabled={isPushingNotes}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#C17F3E] text-[#0C0C0C] font-medium hover:bg-[#D4923F] disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isPushingNotes && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    )}

    {/* Search Popup */}
    <SearchPopup
      isOpen={showSearchPopup}
      onClose={() => setShowSearchPopup(false)}
    />
    </>
  );
}
