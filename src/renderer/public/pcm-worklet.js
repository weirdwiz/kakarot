/**
 * PCM Audio Worklet Processor
 * Captures raw PCM audio and calculates RMS for level monitoring
 */
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    
    // Calculate RMS (Root Mean Square) for volume level
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    // Create a copy of the PCM data
    const pcm = channelData.slice();

    // Post message with audio data and RMS
    this.port.postMessage({ type: "audio", rms, pcm }, [pcm.buffer]);

    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
