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
      if (!micWorkletLoadedRef.current) {
        await audioContext.audioWorklet.addModule(WORKLET_PROCESSOR_URL);
        micWorkletLoadedRef.current = true;
      }

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');

      workletNode.port.onmessage = (event) => {
        if (isPausedRef.current) return;

        const { pcmData, level } = event.data;
        window.kakarot.audio.sendData(pcmData, 'mic');

        const currentLevels = useAppStore.getState().audioLevels;
        setAudioLevels({ ...currentLevels, mic: level });
      };

      workletNode.onprocessorerror = (event) => {
        console.error('[AudioCapture] Worklet processor error:', event);
      };

      sourceNode.connect(workletNode);
      return { worklet: workletNode, sourceNode };
    },
    [setAudioLevels]
  );

  const startCapture = useCallback(async () => {
    try {
      micAudioContextRef.current = new AudioContext();

      if (micAudioContextRef.current.state === 'suspended') {
        await micAudioContextRef.current.resume();
      }

      // Disable browser AEC - it only cancels echo from audio played BY this app,
      // not from other apps (Zoom, Meet, etc.). Our native AEC handles external audio.
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          echoCancellation: false,     // Disable - doesn't help with external audio
          noiseSuppression: false,     // Let native module handle this
          autoGainControl: false,      // Let native module handle this
        },
        video: false,
      });

      const micTrack = micStreamRef.current.getAudioTracks()[0];
      micTrack.onended = () => console.error('[AudioCapture] Mic track ended unexpectedly');

      const micResult = await setupMicWorklet(micAudioContextRef.current, micStreamRef.current);
      if (micResult) {
        micWorkletRef.current = micResult.worklet;
        micSourceRef.current = micResult.sourceNode;
      }
    } catch (error) {
      console.error('[AudioCapture] Failed to start mic capture:', error);
    }
  }, [setupMicWorklet]);

  const stopCapture = useCallback(async () => {
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    if (micWorkletRef.current) {
      micWorkletRef.current.disconnect();
      micWorkletRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (micAudioContextRef.current) {
      await micAudioContextRef.current.close();
      micAudioContextRef.current = null;
    }

    micWorkletLoadedRef.current = false;
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
