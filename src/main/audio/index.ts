/**
 * Main Process Audio Module Exports
 */

export { NativeAudioCapture, isNativeAudioAvailable } from "./nativeAudioCapture";
export {
  AudioService,
  getAudioService,
  type AudioServiceConfig,
  type AudioDataCallback,
} from "./AudioService";
