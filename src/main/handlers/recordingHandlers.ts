import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { createTranscriptionProvider, ITranscriptionProvider } from '../services/transcription';
import { DualAudioService } from '../services/DualAudioService';
import { showCalloutWindow } from '../windows/calloutWindow';
import { getDatabase, saveDatabase } from '../data/database';

const logger = createLogger('RecordingHandlers');

let transcriptionProvider: ITranscriptionProvider | null = null;
let dualAudioService: DualAudioService | null = null;
let activeCalendarContext: {
  calendarEventId: string;
  calendarEventTitle: string;
  calendarEventAttendees?: string[];
  calendarEventStart: string;
  calendarEventEnd: string;
  calendarProvider: string;
} | null = null;

async function stopAudioCapture(): Promise<void> {
  if (dualAudioService) {
    const das = dualAudioService;
    dualAudioService = null;
    await das.stop().catch((error) => logger.error('Audio capture stop error', error));
    logger.info('Audio capture stopped');
  }
}

async function stopTranscription(): Promise<void> {
  if (transcriptionProvider) {
    const tp = transcriptionProvider;
    transcriptionProvider = null;
    await tp.disconnect().catch((error) => logger.error('Transcription disconnect error', error));
    logger.info('Transcription provider disconnected');
  }
  // Wait for any remaining finals to arrive and be stored
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

interface CalendarContext {
  calendarEventId: string;
  calendarProvider: string;
}

async function generateAndSaveNotes(
  meetingId: string,
  calendarContext: CalendarContext | null,
  sendToRenderer: (channel: string, data: unknown) => void
): Promise<void> {
  const { meetingRepo, noteGenerationService, calendarService } = getContainer();
  const fullMeeting = meetingRepo.findById(meetingId);

  if (!fullMeeting || fullMeeting.transcript.length === 0) {
    logger.warn('No transcript segments to generate notes from');
    sendToRenderer(IPC_CHANNELS.RECORDING_STATE, 'idle');
    return;
  }

  sendToRenderer(IPC_CHANNELS.MEETING_NOTES_GENERATING, { meetingId });

  try {
    logger.info('Notes generation started', { meetingId });
    const notes = await noteGenerationService.generateNotes(fullMeeting);

    if (notes) {
      logger.info('Notes generated successfully', { meetingId });
      meetingRepo.updateNotes(meetingId, null, notes.notesMarkdown, notes.notesMarkdown);
      meetingRepo.updateOverview(meetingId, notes.overview);
      const db = getDatabase();
      db.run('UPDATE meetings SET title = ? WHERE id = ?', [notes.title, meetingId]);
      saveDatabase();

      if (calendarContext) {
        calendarService.linkNotesToEvent(
          calendarContext.calendarEventId,
          meetingId,
          calendarContext.calendarProvider as 'google' | 'outlook' | 'icloud'
        ).catch((err) => {
          logger.error('Failed to link notes to calendar event', {
            calendarEventId: calendarContext.calendarEventId,
            error: (err as Error).message,
          });
        });
      }

      sendToRenderer(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
        meetingId,
        title: notes.title,
        overview: notes.overview,
      });
    } else {
      logger.info('Notes generation skipped (no notes returned)', { meetingId });
      sendToRenderer(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
        meetingId,
        title: fullMeeting.title || 'Untitled Meeting',
        overview: '',
      });
    }
  } catch (error) {
    logger.error('Notes generation failed', { meetingId, error: (error as Error).message });
    sendToRenderer(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
      meetingId,
      title: fullMeeting.title || 'Untitled Meeting',
      overview: '',
    });
  }

  sendToRenderer(IPC_CHANNELS.RECORDING_STATE, 'idle');
}

export function registerRecordingHandlers(
  mainWindow: BrowserWindow,
  calloutWindow: BrowserWindow
): void {
  const { calloutService } = getContainer();

  ipcMain.handle(IPC_CHANNELS.RECORDING_START, async (_, calendarContext?: any) => {
    logger.info('Recording start requested', { hasCalendarContext: !!calendarContext });
    const { meetingRepo, settingsRepo } = getContainer();
    const settings = settingsRepo.getSettings();
    logger.debug('Transcription provider', { provider: settings.transcriptionProvider });

    // Store calendar context for later linking
    if (calendarContext) {
      activeCalendarContext = calendarContext;
      logger.info('Calendar context attached to recording', {
        eventId: calendarContext.calendarEventId,
        title: calendarContext.calendarEventTitle,
      });
    }

    // Start meeting with calendar title if available
    const meetingTitle = calendarContext?.calendarEventTitle;
    await meetingRepo.startNewMeeting(meetingTitle);
    logger.info('Meeting started');

    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'recording');

    transcriptionProvider = createTranscriptionProvider(
      settings.transcriptionProvider,
      settings.assemblyAiApiKey,
      settings.deepgramApiKey,
      undefined, // hostedTokenManager not implemented
      settings.useHostedTokens
    );
    logger.info('Using transcription provider', { name: transcriptionProvider.name });

    // Set up transcript forwarding
    transcriptionProvider.onTranscript((segment, isFinal) => {
      logger.debug('Transcript received', {
        source: segment.source,
        isFinal,
        textPreview: segment.text.slice(0, 30),
      });

      const channel = isFinal ? IPC_CHANNELS.TRANSCRIPT_FINAL : IPC_CHANNELS.TRANSCRIPT_UPDATE;

      mainWindow.webContents.send(channel, {
        segment,
        meetingId: meetingRepo.getCurrentMeetingId(),
      });

      // Store final segments
      if (isFinal) {
        meetingRepo.addTranscriptSegment(segment);
      }

      // Check for questions from system audio
      if (isFinal && segment.source === 'system') {
        calloutService.checkForQuestion(segment.text).then((callout) => {
          if (callout) {
            calloutWindow.webContents.send(IPC_CHANNELS.CALLOUT_SHOW, callout);
            showCalloutWindow();
          }
        });
      }
    });

    transcriptionProvider
      .connect()
      .then(async () => {
        logger.info('Transcription provider connected');

        if (!transcriptionProvider) return;

        // Use native synchronized audio capture
        dualAudioService = new DualAudioService();

        dualAudioService.onMicLevel((level) => {
          mainWindow.webContents.send(IPC_CHANNELS.AUDIO_LEVELS, { mic: level });
        });

        dualAudioService.onSystemLevel((level) => {
          mainWindow.webContents.send(IPC_CHANNELS.AUDIO_LEVELS, { system: level });
        });

        try {
          await dualAudioService.start(transcriptionProvider);
          logger.info('Native dual audio capture started (with synchronized AEC)');
        } catch (error) {
          logger.error('Native audio capture failed', error as Error);
          mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'idle');
        }
      })
      .catch((error) => {
        logger.error('Transcription provider connection failed', error);
      });
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async () => {
    logger.info('Recording stop requested');
    const { meetingRepo } = getContainer();
    const meetingId = meetingRepo.getCurrentMeetingId();
    const calendarContext = activeCalendarContext;
    activeCalendarContext = null;

    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'processing');

    await stopAudioCapture();
    await stopTranscription();

    const meeting = await meetingRepo.endCurrentMeeting();
    logger.info('Meeting ended', { id: meeting?.id, transcriptCount: meeting?.transcript.length });

    if (meeting && meetingId) {
      const sendToRenderer = (channel: string, data: unknown) => {
        mainWindow.webContents.send(channel, data);
      };
      await generateAndSaveNotes(meeting.id, calendarContext, sendToRenderer);
    } else {
      logger.warn('No meeting or meetingId available for notes generation');
      mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'idle');
    }

    return meeting;
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_PAUSE, async () => {
    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'paused');
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_RESUME, async () => {
    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'recording');
  });
}
