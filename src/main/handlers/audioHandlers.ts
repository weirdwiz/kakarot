console.log("🚨 AUDIOHANDLERS LOADED - NEW VERSION");
/**
 * Audio IPC Handlers
 * Exposes audio service functionality to renderer process
 */

import { ipcMain, BrowserWindow } from "electron";
import { IPC_CHANNELS } from "@shared/ipcChannels";
import { getAudioService, AudioService, isNativeAudioAvailable } from "@main/audio";
import { createLogger } from "@main/core/logger";
import { getActiveTranscriptionProvider, isRecordingPaused } from "./recordingHandlers";
import { AECSync } from '@main/audio/AECSync';

const logger = createLogger("AudioHandlers");

// Convert Float32 samples (-1..1) to 16-bit PCM ArrayBuffer
function float32ToInt16Buffer(samples: Float32Array): ArrayBuffer {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm.buffer;
}

// Audio buffering to meet AssemblyAI's 50ms minimum chunk size
// At 48kHz: 1024 samples = 21.3ms, need at least 2400 samples (50ms)
const SAMPLE_RATE = 48000;
const MIN_CHUNK_MS = 50;
const MIN_SAMPLES = Math.ceil((SAMPLE_RATE * MIN_CHUNK_MS) / 1000); // 2400 samples
// We already stream system audio via SystemAudioService (AudioTee). Avoid double-sending from native.
const FORWARD_NATIVE_SYSTEM_AUDIO = false;

function computeLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;

  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    sumSquares += v * v;
    const abs = v < 0 ? -v : v;
    if (abs > peak) peak = abs;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  if (rms === 0 && peak === 0) return 0;

  // Convert RMS to dBFS and map -60..0 dB to 0..1 for a more sensitive meter
  const db = 20 * Math.log10(Math.max(rms, 1e-9));
  const rmsMapped = Math.min(1, Math.max(0, (db + 60) / 60));

  // Combine a fast peak with the dB-mapped RMS to keep UI responsive
  return Math.min(1, Math.max(rmsMapped, peak * 6));
}

class AudioBuffer {
  private buffer: Float32Array[] = [];
  private totalSamples = 0;

  push(samples: Float32Array): void {
    this.buffer.push(samples);
    this.totalSamples += samples.length;
  }

  hasEnough(): boolean {
    return this.totalSamples >= MIN_SAMPLES;
  }

  flush(): Float32Array | null {
    if (!this.hasEnough()) return null;

    const result = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const chunk of this.buffer) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    this.buffer = [];
    this.totalSamples = 0;
    return result;
  }

  clear(): void {
    this.buffer = [];
    this.totalSamples = 0;
  }
}

let audioService: AudioService | null = null;
let aecSync: AECSync | null = null;
const micBuffer = new AudioBuffer();
const systemBuffer = new AudioBuffer();

export function registerAudioHandlers(): void {
  // Check if native audio is available
  ipcMain.handle(IPC_CHANNELS.AUDIO_CHECK_NATIVE, () => {
    return isNativeAudioAvailable();
  });

  // Start native audio capture
  ipcMain.handle(
    IPC_CHANNELS.AUDIO_START_NATIVE,
    async (_event, options?: { sampleRate?: number }) => {
      try {
        if (audioService) {
          logger.warn("Audio service already started");
          return { success: true, state: audioService.getState() };
        }

        audioService = getAudioService();

        // Set up callbacks to forward audio to renderer
        const mainWindow = BrowserWindow.getAllWindows()[0];

        if (mainWindow) {
          let processedPacketCount = 0;
          let bufferedMicPacketCount = 0;
          audioService.setProcessedAudioCallback((samples, timestamp) => {
            processedPacketCount++;

            if (processedPacketCount === 1) {
              logger.info('🎤 First processed audio packet received!', {
                samples: samples.length,
                timestamp,
                durationMs: (samples.length / SAMPLE_RATE * 1000).toFixed(1)
              });

              // Initialize AECSync on first mic packet
              const aecProcessor = audioService?.getAECProcessor();
              if (aecProcessor && aecProcessor.isReady()) {
                aecSync = new AECSync(aecProcessor);
                logger.info('✓ AECSync initialized for recording session');
              }
            }

            // Calculate level with dB mapping for better low-level visibility
            const level = computeLevel(samples);

            // Send to renderer with level (handle disposed frames gracefully)
            try {
              if (!mainWindow.isDestroyed() && mainWindow.webContents) {
                mainWindow.webContents.send(IPC_CHANNELS.AUDIO_LEVELS, { mic: level });
              }
            } catch (err) {
              // Frame disposed during hot reload - ignore
            }

            // Process mic audio through AEC with synchronization
            let processedAudio: Float32Array;

            if (aecSync) {
              // Use synchronized AEC processing
              const cleanAudio = aecSync.processCaptureWithSync(samples, timestamp);

              if (cleanAudio && cleanAudio.length > 0) {
                processedAudio = cleanAudio;

                // Log sync stats occasionally
                if (processedPacketCount % 100 === 0) {
                  const stats = aecSync.getStats();
                  logger.debug('AEC sync performance', {
                    syncRate: `${stats.syncRate.toFixed(1)}%`,
                    bufferSize: stats.bufferSize
                  });
                }
              } else {
                // Fallback to raw mic if AEC fails
                logger.warn('AEC sync processing returned empty, using raw mic');
                processedAudio = samples;
              }
            } else {
              // No AEC available, use raw mic
              processedAudio = samples;
            }

            // Buffer audio to meet AssemblyAI's 50ms minimum
            micBuffer.push(processedAudio);

            if (micBuffer.hasEnough()) {
              const buffered = micBuffer.flush();
              if (buffered) {
                bufferedMicPacketCount++;
                const provider = getActiveTranscriptionProvider();
                if (provider && !isRecordingPaused()) {
                  try {
                    const pcmBuffer = float32ToInt16Buffer(buffered);
                    const durationMs = (buffered.length / SAMPLE_RATE * 1000).toFixed(1);
                    provider.sendAudio(pcmBuffer, 'mic');

                    if (bufferedMicPacketCount === 1 || bufferedMicPacketCount % 10 === 0) {
                      logger.info('📦 Buffered mic audio -> transcription', {
                        samples: buffered.length,
                        durationMs,
                        level: level.toFixed(3),
                        packet: bufferedMicPacketCount
                      });
                    }
                  } catch (err) {
                    if (bufferedMicPacketCount === 1) {
                      logger.warn('Transcription not ready yet', {
                        source: 'mic',
                        error: (err as Error).message
                      });
                    }
                  }
                }
              }
            }
          });

          // Raw mic audio - only used for debugging/monitoring, not transcription
          audioService.setMicrophoneAudioCallback((samples, timestamp) => {
            // Send raw mic to renderer for debug purposes only
            try {
              if (!mainWindow.isDestroyed() && mainWindow.webContents) {
                mainWindow.webContents.send(IPC_CHANNELS.AUDIO_MIC_DATA, {
                  samples: Array.from(samples),
                  timestamp,
                });
              }
            } catch (err) {
              // Frame disposed - ignore
            }
            // Note: We use processedAudio (with AEC) for transcription, not raw mic
          });

          let systemPacketCount = 0;
          let bufferedSystemPacketCount = 0;
          audioService.setSystemAudioCallback((samples, timestamp) => {
            systemPacketCount++;

            if (systemPacketCount === 1) {
              logger.info('🔊 First system audio packet received!', {
                samples: samples.length,
                timestamp,
                durationMs: (samples.length / SAMPLE_RATE * 1000).toFixed(1)
              });
            }

            const level = computeLevel(samples);

            // Send level to renderer (handle disposed frames gracefully)
            try {
              if (!mainWindow.isDestroyed() && mainWindow.webContents) {
                mainWindow.webContents.send(IPC_CHANNELS.AUDIO_LEVELS, { system: level });
              }
            } catch (err) {
              // Frame disposed during hot reload - ignore
            }

            // Feed system audio to AEC sync buffer
            if (aecSync) {
              aecSync.addRenderAudio(samples, timestamp);
            }

            // Avoid double-feeding AssemblyAI with system audio (SystemAudioService already streams it)
            if (!FORWARD_NATIVE_SYSTEM_AUDIO) {
              return;
            }

            // Buffer audio to meet AssemblyAI's 50ms minimum
            systemBuffer.push(samples);
            if (systemBuffer.hasEnough()) {
              const buffered = systemBuffer.flush();
              if (buffered) {
                bufferedSystemPacketCount++;
                const provider = getActiveTranscriptionProvider();
                if (provider && !isRecordingPaused()) {
                  try {
                    const pcmBuffer = float32ToInt16Buffer(buffered);
                    const durationMs = (buffered.length / SAMPLE_RATE * 1000).toFixed(1);
                    provider.sendAudio(pcmBuffer, 'system');
                    
                    if (bufferedSystemPacketCount === 1 || bufferedSystemPacketCount % 10 === 0) {
                      logger.info('📦 Buffered system audio -> transcription', {
                        samples: buffered.length,
                        durationMs,
                        level: level.toFixed(3),
                        packet: bufferedSystemPacketCount
                      });
                    }
                  } catch (err) {
                    if (bufferedSystemPacketCount === 1) {
                      logger.warn('Transcription not ready yet', {
                        source: 'system',
                        error: (err as Error).message
                      });
                    }
                  }
                }
              }
            }
          });
        }

        const success = await audioService.start();

        return {
          success,
          state: audioService.getState(),
        };
      } catch (error) {
        logger.error("Failed to start audio capture", { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Stop native audio capture
  ipcMain.handle(IPC_CHANNELS.AUDIO_STOP_NATIVE, () => {
    try {
      if (audioService) {
        audioService.stop();
        audioService = null;
        // Clear buffers on stop
        micBuffer.clear();
        systemBuffer.clear();
      }

      // Clear AEC sync state
      if (aecSync) {
        const finalStats = aecSync.getStats();
        logger.info('Final AEC sync stats', finalStats);
        aecSync.clear();
        aecSync = null;
      }

      return { success: true };
    } catch (error) {
      logger.error("Failed to stop audio capture", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Set echo cancellation enabled
  ipcMain.handle(IPC_CHANNELS.AUDIO_SET_AEC_ENABLED, (_event, enabled: boolean) => {
    if (audioService) {
      audioService.setEchoCancellationEnabled(enabled);
      return { success: true };
    }
    return { success: false, error: "Audio service not running" };
  });

  // Get audio state
  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_STATE, () => {
    if (audioService) {
      return audioService.getState();
    }
    return {
      isRunning: false,
      isNative: false,
      isHeadphonesConnected: false,
      isEchoCancellationEnabled: false,
    };
  });

  logger.info("Audio handlers registered");
}
