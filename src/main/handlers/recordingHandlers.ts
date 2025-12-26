import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { createTranscriptionProvider, ITranscriptionProvider } from '../services/transcription';
import { SystemAudioService } from '../services/SystemAudioService';
import { CalloutService } from '../services/CalloutService';
import { showCalloutWindow } from '../windows/calloutWindow';
import { AUDIO_CONFIG } from '../config/constants';

const logger = createLogger('RecordingHandlers');

let transcriptionProvider: ITranscriptionProvider | null = null;
let systemAudioService: SystemAudioService | null = null;

export function registerRecordingHandlers(
  mainWindow: BrowserWindow,
  calloutWindow: BrowserWindow
): void {
  const calloutService = new CalloutService();

  ipcMain.handle(IPC_CHANNELS.RECORDING_START, async () => {
    logger.info('Recording start requested');
    const { meetingRepo, settingsRepo } = getContainer();
    const settings = settingsRepo.getSettings();
    logger.debug('Transcription provider', { provider: settings.transcriptionProvider });

    // Start meeting
    await meetingRepo.startNewMeeting();
    logger.info('Meeting started');

    // Update UI immediately
    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'recording');

    // Initialize transcription provider based on settings
    transcriptionProvider = createTranscriptionProvider(
      settings.transcriptionProvider,
      settings.assemblyAiApiKey,
      settings.deepgramApiKey
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

    // Connect transcription provider
    transcriptionProvider
      .connect()
      .then(() => {
        logger.info('Transcription provider connected');

        if (transcriptionProvider) {
          systemAudioService = new SystemAudioService();

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
    const { meetingRepo } = getContainer();

    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, 'idle');

    // Stop system audio
    if (systemAudioService) {
      const sas = systemAudioService;
      systemAudioService = null;
      sas
        .stop()
        .then(() => logger.info('System audio capture stopped'))
        .catch((error) => logger.error('System audio stop error', error));
    }

    // Disconnect transcription provider
    if (transcriptionProvider) {
      const tp = transcriptionProvider;
      transcriptionProvider = null;
      tp.disconnect()
        .then(() => logger.info('Transcription provider disconnected'))
        .catch((error) => logger.error('Transcription disconnect error', error));
    }

    const meeting = await meetingRepo.endCurrentMeeting();
    logger.info('Meeting ended', { id: meeting?.id });

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
    if (micAudioDataCount % AUDIO_CONFIG.PACKET_LOG_INTERVAL === 1) {
      logger.debug('Mic audio data received', {
        size: audioData.byteLength,
        count: micAudioDataCount,
      });
    }

    if (transcriptionProvider) {
      transcriptionProvider.sendAudio(audioData, 'mic');
    } else if (micAudioDataCount === 1) {
      logger.warn('Mic audio data received but no transcription provider active');
    }
  });
}
