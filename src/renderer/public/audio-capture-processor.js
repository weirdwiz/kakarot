/* global AudioWorkletProcessor, registerProcessor */

// AudioWorklet processor for microphone capture
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._outputBufferSize = 12288; // ~256ms at 48kHz
    this._outputBuffer = new Float32Array(this._outputBufferSize);
    this._outputIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];

    // Pass through at native sample rate (no resampling)
    for (let i = 0; i < samples.length; i++) {
      this._outputBuffer[this._outputIndex++] = samples[i];

      if (this._outputIndex >= this._outputBufferSize) {
        this._sendBuffer();
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
