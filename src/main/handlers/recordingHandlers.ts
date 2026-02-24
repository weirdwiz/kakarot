import { app, ipcMain, BrowserWindow, systemPreferences } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { createTranscriptionProvider, ITranscriptionProvider } from '../services/transcription';
import { getDeepgramTokenService } from '../services/DeepgramTokenService';
import { SystemAudioService } from '../services/SystemAudioService';
import { CalloutService } from '../services/CalloutService';
import { MicActivityMonitor } from '../services/MicActivityMonitor';
import { AECProcessor } from '../audio/native/AECProcessor';
import { AECSync } from '../audio/AECSync';
import { showCalloutWindow } from '../windows/calloutWindow';
import { AUDIO_CONFIG, matchesQuestionPattern, FEATURE_FLAGS } from '../config/constants';
import { getDatabase, saveDatabase } from '../data/database';
import { isMeetingApp } from '../utils/meetingAppDetection';
import { markRecordingActive, clearRecoveryState } from '../services/RecoveryService';
import type { CalendarAttendee, Meeting, RecordingState } from '@shared/types';
import type { IndicatorWindow } from '../windows/IndicatorWindow';

const logger = createLogger('RecordingHandlers');

let transcriptionProvider: ITranscriptionProvider | null = null;
let systemAudioService: SystemAudioService | null = null;
let aecProcessor: AECProcessor | null = null;
let aecSync: AECSync | null = null;
let micActivityMonitor: MicActivityMonitor | null = null;
let stopInProgress = false;
let activeCalendarContext: {
  calendarEventId: string;
  calendarEventTitle: string;
  calendarEventAttendees?: CalendarAttendee[];
  calendarEventStart: string;
  calendarEventEnd: string;
  calendarProvider: string;
} | null = null;
let isPaused = false;
let lastMicApps: string[] = [];
let meetingAppSeen = false;
let autoStopTimer: NodeJS.Timeout | null = null;
let maxDurationTimer: NodeJS.Timeout | null = null;
let indicatorAmplitudeTimer: NodeJS.Timeout | null = null;
let latestSystemAmplitude = 0;
let latestMicAmplitude = 0;

let micAudioDataCount = 0;

export function registerRecordingHandlers(
  mainWindow: BrowserWindow,
  calloutWindow: BrowserWindow,
  options?: {
    indicatorWindow?: IndicatorWindow | null;
    onRecordingStateChange?: (state: RecordingState) => void;
  }
): void {
  const indicatorWindow = options?.indicatorWindow ?? null;
  const setRecordingState = (state: RecordingState): void => {
    mainWindow.webContents.send(IPC_CHANNELS.RECORDING_STATE, state);
    options?.onRecordingStateChange?.(state);
  };
  const calloutService: CalloutService | null = FEATURE_FLAGS.enableCallouts
    ? new CalloutService()
    : null;
  const selfAppTokens = [app.getName(), 'com.kakarot.app']
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  const AUTO_STOP_GRACE_MS = 5000;
  const MAX_TRANSCRIPTION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

  const clearAutoStopTimer = (): void => {
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
  };

  const clearMaxDurationTimer = (): void => {
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  };

  const startMaxDurationTimer = (): void => {
    clearMaxDurationTimer();
    maxDurationTimer = setTimeout(() => {
      maxDurationTimer = null;
      if (stopInProgress) {
        return;
      }
      logger.info('Auto-stopping recording (max duration reached)', {
        maxDurationMs: MAX_TRANSCRIPTION_DURATION_MS,
      });
      void stopRecording('auto');
    }, MAX_TRANSCRIPTION_DURATION_MS);
  };

  const startIndicatorAmplitudeLoop = (): void => {
    if (!indicatorWindow || indicatorAmplitudeTimer) return;
    indicatorAmplitudeTimer = setInterval(() => {
      const combined = Math.sqrt(
        (latestSystemAmplitude * latestSystemAmplitude + latestMicAmplitude * latestMicAmplitude) /
          2
      );
      indicatorWindow.sendAudioAmplitude(Math.min(1, combined));
    }, 16);
  };

  const stopIndicatorAmplitudeLoop = (): void => {
    if (indicatorAmplitudeTimer) {
      clearInterval(indicatorAmplitudeTimer);
      indicatorAmplitudeTimer = null;
    }
  };

  // Shared audio pipeline teardown used by both stop and discard paths
  const teardownAudioPipeline = async (): Promise<void> => {
    // Stop system audio capture first to prevent new callbacks
    if (systemAudioService) {
      const sas = systemAudioService;
      systemAudioService = null;
      await sas.stop().catch((error) => logger.error('System audio stop error', error));
      logger.info('System audio capture stopped');
    }

    // Stop native mic capture
    if (aecProcessor && aecProcessor.isMicrophoneCapturing()) {
      logger.info('Stopping native microphone capture');
      aecProcessor.stopMicrophoneCapture();
    }

    // Wait for in-flight audio callbacks to drain
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clean up AEC sync
    if (aecSync) {
      const finalStats = aecSync.getStats();
      logger.info('Final AEC sync stats', finalStats);
      aecSync.clear();
      aecSync = null;
    }

    // Clean up AEC processor
    if (aecProcessor) {
      try {
        aecProcessor.destroy();
      } catch (error) {
        logger.warn('Error destroying AEC processor', { error: (error as Error).message });
      }
      aecProcessor = null;
    }

    micAudioDataCount = 0;

    // Disconnect transcription and wait for flush
    if (transcriptionProvider) {
      const tp = transcriptionProvider;
      transcriptionProvider = null;
      await tp.disconnect().catch((error) => logger.error('Transcription disconnect error', error));
      logger.info('Transcription provider disconnected');
    }

    isPaused = false;
  };

  const resetMicMonitorState = (): void => {
    clearAutoStopTimer();
    lastMicApps = [];
    meetingAppSeen = false;
  };

  const isSelfApp = (appIdOrName: string): boolean => {
    const lower = appIdOrName.toLowerCase();
    return selfAppTokens.some((token) => lower.includes(token));
  };

  const getMicEntries = (apps: string[]): string[] => {
    return apps.filter((entry) => entry.toLowerCase().startsWith('mic:'));
  };

  const handleMicAppsUpdate = (apps: string[], raw: string, timestamp: number): void => {
    lastMicApps = apps;
    mainWindow.webContents.send(IPC_CHANNELS.MIC_APPS_UPDATE, {
      apps,
      raw,
      timestamp,
    });
    logger.debug('Mic activity update', { apps, raw });

    const micApps = getMicEntries(apps);
    const externalMicApps = micApps.filter((entry) => !isSelfApp(entry));
    const meetingApps = externalMicApps.filter((entry) => isMeetingApp(entry));

    if (meetingApps.length > 0) {
      meetingAppSeen = true;
      clearAutoStopTimer();
      return;
    }

    if (!meetingAppSeen || autoStopTimer) {
      return;
    }

    autoStopTimer = setTimeout(() => {
      autoStopTimer = null;
      if (stopInProgress || !meetingAppSeen) {
        return;
      }

      const latestMicApps = getMicEntries(lastMicApps);
      const latestExternalMicApps = latestMicApps.filter((entry) => !isSelfApp(entry));
      const latestMeetingApps = latestExternalMicApps.filter((entry) => isMeetingApp(entry));

      if (latestMeetingApps.length === 0 && transcriptionProvider) {
        logger.info('Auto-stopping recording (no meeting mic apps detected)', {
          lastMicApps,
        });
        void stopRecording('auto');
      } else {
        logger.debug('Auto-stop aborted; meeting mic apps detected', {
          latestMeetingApps,
        });
      }
    }, AUTO_STOP_GRACE_MS);
  };

  const startMicActivityMonitor = (): void => {
    if (micActivityMonitor) {
      return;
    }

    micActivityMonitor = new MicActivityMonitor((update) => {
      handleMicAppsUpdate(update.apps, update.raw, update.timestamp);
    });
    micActivityMonitor.start();
    logger.info('Mic activity monitor started');
  };

  const stopMicActivityMonitor = (): void => {
    if (micActivityMonitor) {
      micActivityMonitor.stop();
      micActivityMonitor = null;
    }
    resetMicMonitorState();
    logger.info('Mic activity monitor stopped');
  };

  const stopRecording = async (reason: 'manual' | 'auto'): Promise<Meeting | null> => {
    if (stopInProgress) {
      logger.warn('Recording stop requested while already stopping', { reason });
      return null;
    }
    stopInProgress = true;
    clearAutoStopTimer();
    clearMaxDurationTimer();
    stopIndicatorAmplitudeLoop();
    stopMicActivityMonitor();
    if (reason === 'auto') {
      mainWindow.webContents.send(IPC_CHANNELS.RECORDING_AUTO_STOPPED);
    }

    try {
      logger.info('Recording stop requested', { reason });
      const { meetingRepo, noteGenerationService, calendarService } = getContainer();
      const meetingId = meetingRepo.getCurrentMeetingId();
      const calendContext = activeCalendarContext;
      activeCalendarContext = null;

      setRecordingState('processing');

      calloutService?.reset();
      await teardownAudioPipeline();

      // Wait for remaining final transcripts to arrive and be stored
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const meeting = await meetingRepo.endCurrentMeeting();
      logger.info('Meeting ended', {
        id: meeting?.id,
        transcriptCount: meeting?.transcript.length,
      });

      // Helper to emit completion and transition to idle
      const emitNotesComplete = (id: string, title: string, overview = ''): void => {
        mainWindow.webContents.send(IPC_CHANNELS.MEETING_NOTES_COMPLETE, {
          meetingId: id,
          title,
          overview,
        });
        setRecordingState('idle');
      };

      const fullMeeting = meeting ? meetingRepo.findById(meeting.id) : null;

      // Early exit: no meeting data
      if (!meeting || !meetingId || !fullMeeting) {
        logger.warn('No meeting data available for notes generation');
        emitNotesComplete(meetingId || 'unknown', 'Meeting Error');
        clearRecoveryState();
        return meeting;
      }

      // Early exit: insufficient transcript for notes
      if (fullMeeting.transcript.length < 2) {
        logger.info('Skipping notes generation - insufficient transcript', {
          meetingId: meeting.id,
          transcriptLength: fullMeeting.transcript.length,
        });
        emitNotesComplete(meeting.id, fullMeeting.title || 'Untitled Meeting');
        clearRecoveryState();
        return meeting;
      }

      mainWindow.webContents.send(IPC_CHANNELS.MEETING_NOTES_GENERATING, { meetingId: meeting.id });

      try {
        logger.info('Notes generation started', { meetingId: meeting.id });
        const notes = await noteGenerationService.generateNotes(fullMeeting);

        if (!notes) {
          logger.info('Notes generation returned null', { meetingId: meeting.id });
          emitNotesComplete(meeting.id, fullMeeting.title || 'Untitled Meeting');
          clearRecoveryState();
          return meeting;
        }

        logger.info('Notes generated successfully', { meetingId: meeting.id });
        meetingRepo.updateNotes(meeting.id, notes, notes.notesMarkdown, notes.notesMarkdown);
        meetingRepo.updateOverview(meeting.id, notes.overview);

        if (notes.participants && notes.participants.length > 0) {
          const peopleData = notes.participants.map((name: string) => ({ name }));
          meetingRepo.updatePeople(meeting.id, peopleData);
          logger.info('Stored extracted participants', {
            meetingId: meeting.id,
            participantCount: notes.participants.length,
          });
        }

        saveDatabase();

        // Use AI-generated title only when no calendar context provides one
        if (!calendContext) {
          const db = getDatabase();
          db.run('UPDATE meetings SET title = ? WHERE id = ?', [notes.title, meeting.id]);
          saveDatabase();
        }

        // Link notes back to calendar event if context exists
        if (calendContext) {
          calendarService
            .linkNotesToEvent(
              calendContext.calendarEventId,
              meeting.id,
              calendContext.calendarProvider as 'google' | 'outlook' | 'icloud'
            )
            .catch((err) => {
              logger.error('Failed to link notes to calendar event', {
                calendarEventId: calendContext.calendarEventId,
                error: (err as Error).message,
              });
            });
        }

        emitNotesComplete(meeting.id, notes.title, notes.overview);
      } catch (error) {
        logger.error('Notes generation failed', {
          meetingId: meeting.id,
          error: (error as Error).message,
        });
        emitNotesComplete(meeting.id, fullMeeting.title || 'Untitled Meeting');
      }

      clearRecoveryState();
      return meeting;
    } finally {
      stopInProgress = false;
    }
  };

  ipcMain.handle(
    IPC_CHANNELS.RECORDING_START,
    async (
      _,
      calendarContext?: {
        calendarEventId: string;
        calendarEventTitle: string;
        calendarEventAttendees?: CalendarAttendee[];
        calendarEventStart: string;
        calendarEventEnd: string;
        calendarProvider: string;
      }
    ) => {
      logger.info('Recording start requested', { hasCalendarContext: !!calendarContext });

      if (process.platform === 'darwin') {
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        if (micStatus !== 'granted') {
          const granted = await systemPreferences.askForMediaAccess('microphone');
          if (!granted) {
            throw new Error('Microphone permission denied');
          }
        }
      }

      const { meetingRepo } = getContainer();
      if (calendarContext) {
        activeCalendarContext = calendarContext;
        logger.info('Calendar context attached to recording', {
          eventId: calendarContext.calendarEventId,
          title: calendarContext.calendarEventTitle,
        });
      }

      const meetingTitle = calendarContext?.calendarEventTitle;
      const attendeeEmails = calendarContext?.calendarEventAttendees;
      const meetingId = await meetingRepo.startNewMeeting(meetingTitle, attendeeEmails);
      markRecordingActive(meetingId, meetingTitle || 'Untitled Meeting');
      logger.info('Meeting started', {
        meetingId,
        meetingTitle,
        hadCalendarContext: !!calendarContext,
        attendeeCount: attendeeEmails?.length || 0,
      });

      setRecordingState('recording');
      startMicActivityMonitor();
      startIndicatorAmplitudeLoop();
      startMaxDurationTimer();

      void (async () => {
        try {
          aecProcessor = new AECProcessor({
            enableAec: true,
            enableNs: true,
            enableAgc: true,
            frameDurationMs: 10,
            sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
          });
          logger.info('AEC processor initialized');

          try {
            aecSync = new AECSync(aecProcessor);
            logger.info('AECSync initialized');
          } catch (error) {
            logger.error('Failed to initialize AECSync', { error: (error as Error).message });
            aecSync = null;
          }
        } catch (error) {
          logger.error('Failed to initialize AEC processor', { error: (error as Error).message });
          aecProcessor = null;
          aecSync = null;
        }

        const tokenService = getDeepgramTokenService();
        const tokenResponse = await tokenService.getTemporaryToken();
        logger.info('Deepgram temporary token acquired', {
          expiresIn: tokenResponse.expires_in,
        });

        transcriptionProvider = createTranscriptionProvider({ token: tokenResponse.access_token });
        logger.info('Using transcription provider', {
          name: transcriptionProvider.name,
          authMethod: 'JWT token (secure)',
        });

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

          if (isFinal) {
            meetingRepo.addTranscriptSegment(segment);

            if (calloutService) {
              calloutService.addTranscriptSegment(segment);

              if (segment.source === 'system' && matchesQuestionPattern(segment.text)) {
                calloutService.scheduleCallout(segment.text, (callout) => {
                  calloutWindow.webContents.send(IPC_CHANNELS.CALLOUT_SHOW, callout);
                  showCalloutWindow();
                });
              }

              if (segment.source === 'mic') {
                calloutService.checkForMicResponse(segment.text);
              }
            }
          }
        });

        transcriptionProvider
          .connect()
          .then(() => {
            logger.info('Transcription provider connected');

            if (transcriptionProvider) {
              systemAudioService = new SystemAudioService();

              // Pass shared AEC processor
              if (aecProcessor) {
                systemAudioService.setAECProcessor(aecProcessor);
              }

              // Feed system audio to AECSync for synchronization
              if (aecSync) {
                systemAudioService.onSystemAudio((samples, timestamp) => {
                  // Null-safety check: aecSync might be cleaned up during shutdown
                  if (aecSync) {
                    aecSync.addRenderAudio(samples, timestamp);
                  }
                });
              }

              systemAudioService.onAudioLevel((level) => {
                latestSystemAmplitude = level;
                mainWindow.webContents.send(IPC_CHANNELS.AUDIO_LEVELS, { system: level });
              });

              systemAudioService
                .start(transcriptionProvider)
                .then(() => {
                  logger.info('System audio capture started');

                  // Start native microphone capture
                  if (aecProcessor && transcriptionProvider) {
                    const tp = transcriptionProvider; // Capture in closure

                    const success = aecProcessor.startMicrophoneCapture((samples, timestamp) => {
                      micAudioDataCount++;
                      if (micAudioDataCount % AUDIO_CONFIG.PACKET_LOG_INTERVAL === 1) {
                        logger.debug('Native mic audio received', {
                          size: samples.length,
                          timestamp,
                          count: micAudioDataCount,
                        });
                      }

                      if (isPaused || !tp) {
                        return;
                      }

                      let cleanFloat32: Float32Array | null = null;

                      if (aecSync) {
                        cleanFloat32 = aecSync.processCaptureWithSync(samples, timestamp);
                        if (micAudioDataCount % 100 === 0) {
                          const stats = aecSync.getStats();
                          logger.debug('AEC sync performance', {
                            syncRate: `${stats.syncRate.toFixed(1)}%`,
                            bufferSize: stats.bufferSize,
                            packet: micAudioDataCount,
                          });
                        }
                      } else if (aecProcessor && aecProcessor.isReady()) {
                        cleanFloat32 = aecProcessor.processCaptureAudio(samples);
                      }

                      const micSamples = cleanFloat32 ?? samples;
                      let micSumSquares = 0;
                      for (let i = 0; i < micSamples.length; i++) {
                        const sample = micSamples[i];
                        micSumSquares += sample * sample;
                      }
                      const micRms = Math.sqrt(micSumSquares / micSamples.length);
                      latestMicAmplitude = Math.min(1, micRms * 3);

                      // Convert Float32 to Int16 and send immediately
                      const sourceSamples =
                        cleanFloat32 && cleanFloat32.length > 0 ? cleanFloat32 : samples;
                      const isAec = sourceSamples === cleanFloat32;

                      if (!isAec && micAudioDataCount % 100 === 1) {
                        logger.warn('AEC returned empty, using raw mic audio', {
                          micAudioDataCount,
                        });
                      }

                      const int16 = new Int16Array(sourceSamples.length);
                      for (let i = 0; i < sourceSamples.length; i++) {
                        int16[i] = Math.max(-32768, Math.min(32767, sourceSamples[i] * 32768));
                      }

                      tp.sendAudio(int16.buffer as ArrayBuffer, 'mic');

                      if (micAudioDataCount % 100 === 1) {
                        logger.debug(`Mic audio sent (${isAec ? 'AEC' : 'raw'})`, {
                          samples: int16.length,
                          bytes: int16.buffer.byteLength,
                          packet: micAudioDataCount,
                        });
                      }
                    });

                    if (success) {
                      logger.info('Native microphone capture started');
                    } else {
                      logger.error('Failed to start native microphone capture');
                    }
                  }
                })
                .catch((error) => {
                  logger.error('System audio capture failed', error);
                });
            }
          })
          .catch((error) => {
            logger.error('Transcription provider connection failed', error);
          });
      })().catch((error) => {
        logger.error('Recording startup failed', error);
      });

      return meetingId;
    }
  );

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async () => stopRecording('manual'));

  ipcMain.handle(IPC_CHANNELS.RECORDING_PAUSE, async () => {
    isPaused = true;
    calloutService?.cancelPendingCallout();
    systemAudioService?.pause();

    if (aecProcessor && aecProcessor.isMicrophoneCapturing()) {
      logger.info('Stopping microphone capture on pause');
      aecProcessor.stopMicrophoneCapture();
    }

    transcriptionProvider?.pause?.();
    setRecordingState('paused');
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_RESUME, async () => {
    isPaused = false;
    systemAudioService?.resume();

    if (aecProcessor && !aecProcessor.isMicrophoneCapturing()) {
      logger.info('Restarting microphone capture on resume');
      aecProcessor.startMicrophoneCapture((samples: Float32Array, timestamp: number) => {
        micAudioDataCount += samples.length;
        if (transcriptionProvider && !isPaused) {
          transcriptionProvider.send?.(samples, timestamp, 'microphone');
        }
      });
    }

    transcriptionProvider?.resume?.();
    setRecordingState('recording');
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_DISCARD, async () => {
    logger.info('Recording discard requested');
    const { meetingRepo } = getContainer();
    const meetingId = meetingRepo.getCurrentMeetingId();

    calloutService?.reset();
    activeCalendarContext = null;
    stopMicActivityMonitor();

    await teardownAudioPipeline();

    meetingRepo.clearCurrentMeeting();
    if (meetingId) {
      try {
        meetingRepo.delete(meetingId);
        logger.info('Meeting discarded', { meetingId });
      } catch (error) {
        logger.error('Failed to delete meeting on discard', { error: (error as Error).message });
      }
    }

    clearRecoveryState();
    setRecordingState('idle');
    logger.info('Recording discarded successfully');
  });
}

// Expose transcription state for other handlers (e.g., audioHandlers)
export function getActiveTranscriptionProvider(): ITranscriptionProvider | null {
  return transcriptionProvider;
}

export function isRecordingPaused(): boolean {
  return isPaused;
}
