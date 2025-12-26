import React from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from '../hooks/useAudioCapture';
import AudioLevelMeter from './AudioLevelMeter';
import LiveTranscript from './LiveTranscript';
import { Circle, Square, Pause, Play } from 'lucide-react';

export default function RecordingView() {
  const { recordingState, audioLevels, liveTranscript, currentPartials, clearLiveTranscript } = useAppStore();
  const { startCapture, stopCapture, pause, resume } = useAudioCapture();

  const handleStartRecording = async () => {
    clearLiveTranscript();
    try {
      await window.kakarot.recording.start();
      await startCapture();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStopRecording = async () => {
    await stopCapture();
    await window.kakarot.recording.stop();
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

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recording</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isIdle && 'Ready to start recording'}
            {isRecording && 'Recording in progress...'}
            {isPaused && 'Recording paused'}
          </p>
        </div>

        {/* Recording controls */}
        <div className="flex items-center gap-3">
          {isIdle ? (
            <button
              onClick={handleStartRecording}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              <Circle className="w-5 h-5 text-red-500 fill-current" />
              Start Recording
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={handleResumeRecording}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={handlePauseRecording}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              <button
                onClick={handleStopRecording}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Audio levels */}
      {(isRecording || isPaused) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <AudioLevelMeter label="Microphone (You)" level={audioLevels.mic} />
          <AudioLevelMeter label="System Audio (Others)" level={audioLevels.system} />
        </div>
      )}

      {/* Live transcript */}
      <div className="flex-1 overflow-hidden">
        <LiveTranscript segments={liveTranscript} currentPartials={currentPartials} />
      </div>
    </div>
  );
}
