import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { createTranscriptionProvider, ITranscriptionProvider } from '../services/transcription';
import { SystemAudioService } from '../services/SystemAudioService';
import { CalloutService } from '../services/CalloutService';
import { showCalloutWindow } from '../windows/calloutWindow';
import { AUDIO_CONFIG, AEC_CONFIG } from '../config/constants';
import { getDatabase, saveDatabase } from '../data/database';
import { AECProcessor } from '../services/audio/processing';

const logger = createLogger('RecordingHandlers');

let transcriptionProvider: ITranscriptionProvider | null = null;
let systemAudioService: SystemAudioService | null = null;
let activeCalendarContext: {
  calendarEventId: string;
  calendarEventTitle: string;
  calendarEventAttendees?: string[];
  calendarEventStart: string;
  calendarEventEnd: string;
  calendarProvider: string;
} | null = null;

export function registerRecordingHandlers(
  mainWindow: BrowserWindow,
  calloutWindow: BrowserWindow
): void {
  const calloutService = new CalloutService();

  ipcMain.handle(IPC_CHANNELS.RECORDING_START, async (_, calendarContext?: any) => {
    logger.info('Recording start requested', { hasCalendarContext: !!calendarContext });
    const { meetingRepo, settingsRepo, hostedTokenManager } = getContainer();
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
      hostedTokenManager,
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
      .then(() => {
        logger.info('Transcription provider connected');

        if (transcriptionProvider) {
          systemAudioService = new SystemAudioService();

          // Set up AEC if enabled
          if (AEC_CONFIG.ENABLED) {
            const aecProcessor = new AECProcessor({
              filterLength: AEC_CONFIG.FILTER_LENGTH,
              referenceBufferMs: AEC_CONFIG.REFERENCE_BUFFER_MS,
              headphoneBypass: AEC_CONFIG.HEADPHONE_BYPASS,
            });
            systemAudioService.setAecProcessor(aecProcessor);
            logger.info('AEC processor configured');
          }

          systemAudioService.onAudioLevel((level) => {
            mainWindow.webContents.send(IPC_CHANNELS.AUDIO_LEVELS, { system: level });
          });

          systemAudioService
            .start(transcriptionProvider)
            .then(() => {
              logger.info('System audio capture started');
            })
            .catch((error) => {
              logger.error('System audio capture failed', error);
            });
        }
      })
      .catch((error) => {
        logger.error('Transcription provider connection failed', error);
      });
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async () => {
    logger.info('Recording stop requested');
    const { meetingRepo, noteGenerationService, calendarService } = getContainer();
    const meetingId = meetingRepo.getCurrentMeetingId();
    const calendContext = activeCalendarContext;
    activeCalendarContext = null;

    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'processing');

    // Stop system audio first
    if (systemAudioService) {
      const sas = systemAudioService;
      systemAudioService = null;
      await sas.stop().catch((error) => logger.error('System audio stop error', error));
      logger.info('System audio capture stopped');
    }

    // Disconnect transcription and wait for it to flush
    if (transcriptionProvider) {
      const tp = transcriptionProvider;
      transcriptionProvider = null;
      await tp.disconnect().catch((error) => logger.error('Transcription disconnect error', error));
      logger.info('Transcription provider disconnected');
    }

    // Wait for any remaining finals to arrive and be stored
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const meeting = await meetingRepo.endCurrentMeeting();
    logger.info('Meeting ended', { id: meeting?.id, transcriptCount: meeting?.transcript.length });

    // Auto-generate notes in background
    if (meeting && meetingId) {
      mainWindow.webContents.send(IPC_CHANNELS.MEETING_NOTES_GENERATING, { meetingId: meeting.id });

      // Re-fetch meeting to get all transcript segments
      const fullMeeting = meetingRepo.findById(meeting.id);
      if (fullMeeting && fullMeeting.transcript.length > 0) {
        // Generate notes safely with try/catch
        try {
          logger.info('Notes generation started', { meetingId: meeting.id });
          const notes = await noteGenerationService.generateNotes(fullMeeting);
          
          if (notes) {
            logger.info('Notes generated successfully', { meetingId: meeting.id });
            meetingRepo.updateNotes(meeting.id, null, notes.notesMarkdown, notes.notesMarkdown);
            meetingRepo.updateOverview(meeting.id, notes.overview);
            const db = getDatabase();
            db.run('UPDATE meetings SET title = ? WHERE id = ?', [notes.title, meeting.id]);
            saveDatabase();

            // Link notes back to calendar event if context exists
            if (calendContext) {
              calendarService.linkNotesToEvent(
                calendContext.calendarEventId,
                meeting.id,
                calendContext.calendarProvider as 'google' | 'outlook' | 'icloud'
              ).catch((err) => {
                logger.error('Failed to link notes to calendar event', {
                  calendarEventId: calendContext.calendarEventId,
                  error: (err as Error).message,
                });
              });
            }

            mainWindow.webContents.send(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
              meetingId: meeting.id,
              title: notes.title,
              overview: notes.overview,
            });
          } else {
            logger.info('Notes generation skipped (no notes returned)', { meetingId: meeting.id });
            mainWindow.webContents.send(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
              meetingId: meeting.id,
              title: fullMeeting.title || 'Untitled Meeting',
              overview: '',
            });
          }
        } catch (error) {
          logger.error('Notes generation failed', { 
            meetingId: meeting.id, 
            error: (error as Error).message 
          });
          // Still emit completion event so renderer can navigate
          mainWindow.webContents.send(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
            meetingId: meeting.id,
            title: fullMeeting.title || 'Untitled Meeting',
            overview: '',
          });
        }
        mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'idle');
      } else {
        logger.warn('No transcript segments to generate notes from');
        mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'idle');
      }
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

  // Audio data handler
  let micAudioDataCount = 0;

  ipcMain.on(IPC_CHANNELS.AUDIO_DATA, (_, audioData: ArrayBuffer, source: 'mic' | 'system') => {
    if (source !== 'mic') return;

    micAudioDataCount++;

    // Use synchronized timestamp from SystemAudioService to match mic/system audio
    // This ensures both audio streams use the same time origin
    const timestamp = systemAudioService?.getTimestamp() ?? 0;

    if (micAudioDataCount % AUDIO_CONFIG.PACKET_LOG_INTERVAL === 1) {
      logger.debug('Mic audio data received', {
        size: audioData.byteLength,
        count: micAudioDataCount,
        timestamp,
      });
    }

    // Feed mic audio to AEC as reference signal
    if (systemAudioService) {
      systemAudioService.feedMicReference(audioData, timestamp);
    }

    // Send to transcription provider
    if (transcriptionProvider) {
      transcriptionProvider.sendAudio(audioData, 'mic');
    } else if (micAudioDataCount === 1) {
      logger.warn('Mic audio data received but no transcription provider active');
    }
  });
}
