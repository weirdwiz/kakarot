/**
 * Kakarot Audio - Native synchronized dual-stream audio capture with AEC.
 *
 * Captures microphone and system audio with aligned timestamps.
 * Applies Acoustic Echo Cancellation to remove speaker feedback from mic.
 */

export interface AudioConfig {
  /** Sample rate in Hz (default: 48000) */
  sampleRate?: number;
  /** Chunk duration in milliseconds (default: 256) */
  chunkDurationMs?: number;
  /** Number of channels (default: 1 for mono) */
  channels?: number;
  /** Enable acoustic echo cancellation (default: true) */
  enableAEC?: boolean;
  /** Bypass AEC when headphones detected (default: true) */
  bypassAECOnHeadphones?: boolean;
}

export interface SynchronizedAudioFrame {
  /** Microphone audio buffer (16-bit PCM), undefined if not available */
  mic?: Buffer;
  /** System audio buffer (16-bit PCM), undefined if not available */
  system?: Buffer;
  /** Timestamp in mach_absolute_time units */
  timestamp: number;
  /** Whether mic data is present */
  hasMic: boolean;
  /** Whether system data is present */
  hasSystem: boolean;
  /** Microphone RMS level (0-1) */
  micLevel: number;
  /** System audio RMS level (0-1) */
  systemLevel: number;
}

export type AudioFrameCallback = (frame: SynchronizedAudioFrame) => void;

/** Opaque handle to a capture instance */
export type CaptureHandle = number;

/**
 * Create a new combined audio capture instance.
 * @param config Optional configuration
 * @returns Handle to the capture instance
 */
export function create(config?: AudioConfig): CaptureHandle;

/**
 * Set the callback for receiving audio frames.
 * Must be called before start().
 * @param handle Capture handle
 * @param callback Function called with synchronized audio frames
 */
export function setCallback(handle: CaptureHandle, callback: AudioFrameCallback): void;

/**
 * Start capturing audio.
 * @param handle Capture handle
 * @returns Promise that resolves when capture starts
 */
export function start(handle: CaptureHandle): Promise<void>;

/**
 * Stop capturing audio.
 * @param handle Capture handle
 */
export function stop(handle: CaptureHandle): void;

/**
 * Destroy a capture instance and release resources.
 * @param handle Capture handle
 */
export function destroy(handle: CaptureHandle): void;

/**
 * Check if currently capturing.
 * @param handle Capture handle
 * @returns true if capturing
 */
export function isCapturing(handle: CaptureHandle): boolean;

/**
 * Check if this platform supports synchronized audio capture.
 * Requires macOS 13.0+.
 * @returns true if supported
 */
export function isSupported(): boolean;
