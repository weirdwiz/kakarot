import { useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';

// Static worklet processor URL - served from public directory
const WORKLET_PROCESSOR_URL = '/audio-capture-processor.js';

// Microphone-only audio capture hook
// System audio is captured in main process via AudioTee
export function useAudioCapture() {
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micWorkletRef = useRef<AudioWorkletNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isPausedRef = useRef(false);
  const micWorkletLoadedRef = useRef(false);

  const setAudioLevels = useAppStore((state) => state.setAudioLevels);

  const setupMicWorklet = useCallback(
    async (
      audioContext: AudioContext,
      stream: MediaStream
    ): Promise<{ worklet: AudioWorkletNode; sourceNode: MediaStreamAudioSourceNode } | null> => {
      // Load worklet module once per AudioContext
      if (!micWorkletLoadedRef.current) {
        console.log('[AudioCapture] Loading worklet module for mic...');
        try {
          await audioContext.audioWorklet.addModule(WORKLET_PROCESSOR_URL);
          micWorkletLoadedRef.current = true;
          console.log('[AudioCapture] Worklet module loaded for mic');
        } catch (error) {
          console.error('[AudioCapture] Failed to load worklet module for mic:', error);
          throw error;
        }
      }

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');

      workletNode.port.onmessage = (event) => {
        if (isPausedRef.current) return;

        const { pcmData, level } = event.data;
        window.kakarot.audio.sendData(pcmData, 'mic');

        // Update mic audio level in store
        const currentLevels = useAppStore.getState().audioLevels;
        setAudioLevels({
          ...currentLevels,
          mic: level,
        });
      };

      // Monitor worklet errors
      workletNode.onprocessorerror = (event) => {
        console.error('[AudioCapture] Worklet processor error (mic):', event);
      };

      sourceNode.connect(workletNode);

      return { worklet: workletNode, sourceNode };
    },
    [setAudioLevels]
  );

  const startCapture = useCallback(async () => {
    console.log('[AudioCapture] Starting mic capture...');

    try {
      console.log('[AudioCapture] Creating mic AudioContext...');
      micAudioContextRef.current = new AudioContext();
      console.log('[AudioCapture] Mic AudioContext created, sampleRate:', micAudioContextRef.current.sampleRate);

      if (micAudioContextRef.current.state === 'suspended') {
        await micAudioContextRef.current.resume();
      }

      micAudioContextRef.current.onstatechange = () => {
        console.log('[AudioCapture] Mic AudioContext state:', micAudioContextRef.current?.state);
      };

      console.log('[AudioCapture] Requesting microphone access...');
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });

      const micTrack = micStreamRef.current.getAudioTracks()[0];
      console.log('[AudioCapture] Mic stream obtained:', micTrack?.label);

      micTrack.onended = () => console.error('[AudioCapture] Mic track ENDED unexpectedly');

      const micResult = await setupMicWorklet(
        micAudioContextRef.current,
        micStreamRef.current
      );
      if (micResult) {
        micWorkletRef.current = micResult.worklet;
        micSourceRef.current = micResult.sourceNode;
      }
      console.log('[AudioCapture] Mic worklet connected');
    } catch (error) {
      console.error('[AudioCapture] Failed to start mic capture:', error);
    }

    // System audio is captured in main process via AudioTee - no action needed here
    console.log('[AudioCapture] System audio handled by main process via AudioTee');
  }, [setupMicWorklet]);

  const stopCapture = useCallback(async () => {
    console.log('[AudioCapture] Stopping mic capture...');

    // Disconnect source node first
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    // Disconnect worklet node
    if (micWorkletRef.current) {
      micWorkletRef.current.disconnect();
      micWorkletRef.current = null;
    }

    // Stop stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Close audio context
    if (micAudioContextRef.current) {
      await micAudioContextRef.current.close();
      micAudioContextRef.current = null;
    }

    // Reset worklet loaded flag for next session
    micWorkletLoadedRef.current = false;
    console.log('[AudioCapture] Mic capture stopped');
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
  }, []);

  return {
    startCapture,
    stopCapture,
    pause,
    resume,
  };
}
