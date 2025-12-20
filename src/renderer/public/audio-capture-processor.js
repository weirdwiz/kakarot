/**
 * AudioWorklet processor for capturing and processing audio data.
 * Buffers samples, resamples to 16kHz, calculates RMS levels, and converts to 16-bit PCM.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._targetSampleRate = 16000;
    this._inputSampleRate = sampleRate; // AudioWorklet global
    this._resampleRatio = this._inputSampleRate / this._targetSampleRate;

    // Buffer size after resampling (target ~256ms chunks at 16kHz = 4096 samples)
    this._outputBufferSize = 4096;
    this._outputBuffer = new Float32Array(this._outputBufferSize);
    this._outputIndex = 0;

    // Accumulator for fractional sample positions during resampling
    this._resampleAccumulator = 0;

    console.log(
      '[AudioCaptureProcessor] Initialized: input=' +
        this._inputSampleRate +
        'Hz, target=' +
        this._targetSampleRate +
        'Hz, ratio=' +
        this._resampleRatio.toFixed(3)
    );
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];

    // Simple linear resampling from input rate to 16kHz
    for (let i = 0; i < samples.length; i++) {
      this._resampleAccumulator += 1;

      // Output a sample when we've accumulated enough input samples
      if (this._resampleAccumulator >= this._resampleRatio) {
        this._resampleAccumulator -= this._resampleRatio;
        this._outputBuffer[this._outputIndex++] = samples[i];

        if (this._outputIndex >= this._outputBufferSize) {
          this._sendBuffer();
        }
      }
    }

    return true;
  }

  _sendBuffer() {
    // Calculate RMS level
    let sum = 0;
    for (let j = 0; j < this._outputBufferSize; j++) {
      sum += this._outputBuffer[j] * this._outputBuffer[j];
    }
    const rms = Math.sqrt(sum / this._outputBufferSize);
    const level = Math.min(1, rms * 5);

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(this._outputBufferSize);
    for (let j = 0; j < this._outputBufferSize; j++) {
      const s = Math.max(-1, Math.min(1, this._outputBuffer[j]));
      pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage({ pcmData: pcmData.buffer, level }, [pcmData.buffer]);

    // Reset buffer
    this._outputIndex = 0;
    this._outputBuffer = new Float32Array(this._outputBufferSize);
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
