# WebRTC AEC Integration Guide for Kakarot

## Overview
This guide documents the integration of WebRTC Acoustic Echo Cancellation (AEC3) into the Kakarot Electron application to prevent microphone capture of speaker audio.

## Architecture

### Three-Path Audio Processing

```
System Audio (Speakers)
         ↓
  processRenderAudio()  ← AEC learns what's playing to speakers
         ↓
    [AEC Reference]
         ↓
Microphone Audio
         ↓
  processCaptureAudio()  ← AEC removes speaker audio from mic
         ↓
   Echo-Cancelled Audio → Transcription Service
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **AECProcessor** | `src/main/audio/native/AECProcessor.ts` | TypeScript wrapper for native WebRTC AEC |
| **AudioService** | `src/main/audio/AudioService.ts` | Manages native capture + AEC lifecycle |
| **audioHandlers** | `src/main/handlers/audioHandlers.ts` | Routes mic/system audio through AEC |
| **Native Module** | `native/build/Release/audio_capture_native.node` | WebRTC audio_processing (17MB) |

## Integration Points

### 1. AECProcessor Initialization (AudioService)

**File:** `src/main/audio/AudioService.ts`

```typescript
private aecProcessor: AECProcessor | null = null;
private aecMetricsInterval: NodeJS.Timeout | null = null;

private initializeAECProcessor(): void {
  const aecConfig: AECConfig = {
    enableAec: true,
    enableNs: true,  // Noise suppression
    enableAgc: false, // Auto-gain control
    disableAecOnHeadphones: true,
    frameDurationMs: 10,
    sampleRate: 48000,
  };
  
  this.aecProcessor = new AECProcessor(aecConfig);
  
  // Log metrics every 5 seconds
  this.aecMetricsInterval = setInterval(() => {
    const metrics = this.aecProcessor?.getMetrics();
    console.log('ERLE:', metrics.erle, 'dB'); // Echo Return Loss Enhancement
  }, 5000);
}
```

Called in `AudioService.start()` after native capture is initialized.

### 2. System Audio → Render Path (audioHandlers)

**File:** `src/main/handlers/audioHandlers.ts`

System audio (what speakers play) must feed the AEC **before** microphone audio is processed:

```typescript
audioService.setSystemAudioCallback((samples, timestamp) => {
  // Feed to AEC render path
  const aecProcessor = audioService?.getAECProcessor();
  if (aecProcessor && aecProcessor.isReady()) {
    aecProcessor.processRenderAudio(samples); // Tells AEC what to remove from mic
  }
  
  // Continue streaming to transcription (separate path)
  transcriptionProvider.sendAudio(samples, 'system');
});
```

**Important:** System audio flows in TWO directions:
1. **Render path:** Into AEC as reference (does NOT go to transcription)
2. **Transcription path:** Direct to AssemblyAI for other participants' speech

### 3. Microphone Audio → Capture Path (audioHandlers)

**File:** `src/main/handlers/audioHandlers.ts`

Microphone audio is processed through AEC to remove echo:

```typescript
audioService.setProcessedAudioCallback((samples, timestamp) => {
  const aecProcessor = audioService?.getAECProcessor();
  
  let audioToTranscribe = samples; // Default: raw mic
  
  if (aecProcessor && aecProcessor.isReady()) {
    try {
      const cleanAudio = aecProcessor.processCaptureAudio(samples);
      if (cleanAudio) {
        audioToTranscribe = cleanAudio; // Use echo-cancelled version
      }
    } catch (err) {
      console.warn('AEC failed, using raw mic:', err);
    }
  }
  
  // Buffer and send to transcription
  micBuffer.push(audioToTranscribe);
  
  if (micBuffer.hasEnough()) {
    const buffered = micBuffer.flush();
    const pcmBuffer = float32ToInt16Buffer(buffered);
    transcriptionProvider.sendAudio(pcmBuffer, 'mic');
  }
});
```

### 4. Cleanup on Stop (AudioService)

**File:** `src/main/audio/AudioService.ts`

```typescript
stop(): void {
  // ... stop native capture ...
  
  if (this.aecMetricsInterval) {
    clearInterval(this.aecMetricsInterval);
  }
  
  if (this.aecProcessor) {
    this.aecProcessor.destroy(); // Free native resources
  }
}
```

## API Reference

### AECProcessor Methods

#### `constructor(config: AECConfig)`
Initialize the AEC processor with configuration.

```typescript
const aec = new AECProcessor({
  enableAec: true,
  enableNs: true,
  enableAgc: false,
  disableAecOnHeadphones: true,
  frameDurationMs: 10,
  sampleRate: 48000,
});
```

#### `processRenderAudio(renderBuffer: Float32Array): boolean`
Feed far-end (speaker) audio to AEC reference path.

Must be called **before** corresponding `processCaptureAudio()` call.

```typescript
const success = aec.processRenderAudio(systemAudioBuffer);
if (!success) {
  console.warn('Render processing failed');
}
```

#### `processCaptureAudio(captureBuffer: Float32Array): Float32Array | null`
Process microphone audio through echo cancellation.

Returns echo-cancelled audio, or null if processing failed.

```typescript
const cleanAudio = aec.processCaptureAudio(micBuffer);
if (cleanAudio) {
  // Send cleanAudio to transcription
} else {
  // Fall back to raw mic
}
```

#### `getMetrics(): AECMetrics`
Get echo cancellation performance metrics.

```typescript
const metrics = aec.getMetrics();
console.log('ERLE:', metrics.erle, 'dB');        // Echo suppression strength
console.log('RERL:', metrics.rerl, 'dB');        // Residual echo
console.log('Converged:', metrics.converged);    // AEC settled
console.log('DelayMs:', metrics.renderDelayMs); // Estimated delay
```

Available metrics:
- **erle**: Echo Return Loss Enhancement (dB). Higher = better suppression. Target: >15 dB.
- **rerl**: Residual Echo Return Loss (dB). High values indicate less echo.
- **echoPower**: Current echo signal power (0-1).
- **residualEchoLevel**: Remaining echo after cancellation.
- **renderDelayMs**: Estimated delay between render and capture (ms).
- **renderQueueSize**: Buffers pending in render queue.
- **converged**: Whether AEC has adapted to the echo path.

#### `setEchoCancellationEnabled(enabled: boolean)`
Toggle AEC at runtime.

```typescript
aec.setEchoCancellationEnabled(false); // Disable AEC
aec.setEchoCancellationEnabled(true);  // Re-enable
```

#### `reset()`
Clear AEC state between calls.

```typescript
aec.reset(); // Useful when starting new calls
```

#### `destroy()`
Clean up and release native resources.

Must be called before discarding the processor.

```typescript
aec.destroy();
aec = null;
```

#### `isReady(): boolean`
Check if processor is initialized and active.

```typescript
if (aec.isReady()) {
  // Safe to process audio
}
```

## Audio Format Requirements

### Sample Format
- **Type:** Float32Array
- **Range:** -1.0 to 1.0
- **Sample Rate:** 48 kHz (configurable)
- **Channels:** Mono

### Buffer Sizes
- **Optimal:** 480 samples (10 ms @ 48 kHz)
- **Supported:** 480–2880 samples (10–60 ms)
- **Recommended minimum:** 240 samples (5 ms)

### Conversion Helpers

Convert microphone audio before sending to transcription:

```typescript
import { float32ToInt16Array, float32ToInt16Buffer } from './AECProcessor';

// Option 1: Get Int16Array
const int16Samples = float32ToInt16Array(cleanAudio);
const arrayBuffer = int16Samples.buffer;

// Option 2: Get ArrayBuffer directly
const arrayBuffer = float32ToInt16Buffer(cleanAudio);

// Send to transcription
await transcriptionProvider.sendAudio(arrayBuffer, 'mic');
```

## Error Handling

### Graceful Degradation

The system gracefully falls back if AEC initialization fails:

```typescript
private initializeAECProcessor(): void {
  try {
    this.aecProcessor = new AECProcessor(aecConfig);
    logger.info('✅ AEC initialized');
  } catch (error) {
    logger.error('AEC initialization failed:', error);
    logger.warn('Continuing without echo cancellation');
    this.aecProcessor = null; // Mark as unavailable
  }
}
```

When processing audio, check if AEC is available:

```typescript
const cleanAudio = aecProcessor && aecProcessor.isReady()
  ? aecProcessor.processCaptureAudio(samples)
  : null;

const audioToTranscribe = cleanAudio || samples; // Fallback to raw
```

### Common Issues

**Issue:** "Native module not found"
```
Error: Failed to load native audio_capture_native module
```
**Solution:** 
```bash
npm run build:native
```

**Issue:** "Cannot find module 'bindings'"
```
Error: Cannot find module 'bindings'
```
**Solution:**
```bash
npm install bindings
```

**Issue:** AEC returns null for `processCaptureAudio()`
**Cause:** AEC not initialized or destroyed
**Solution:** Check `aec.isReady()` before calling

**Issue:** Echo still present in transcription
**Diagnosis:** 
- Check `getMetrics()` - if ERLE < 5 dB, AEC not converged
- Verify render audio is being processed BEFORE capture audio
- Check audio format (must be Float32, 48 kHz, mono)
- Verify buffer sizes meet minimums (240+ samples)

## Performance Expectations

### Latency
- **Processing latency:** < 10 ms per frame
- **AEC convergence time:** 1–3 seconds
- **Total end-to-end:** < 300 ms (with transcription)

### Quality
- **Echo suppression:** > 15 dB typical
- **Convergence:** > 20 dB after 3+ seconds of reference

### Resource Usage
- **CPU:** ~2–5% (per core, native processing)
- **Memory:** ~50 MB (WebRTC library + runtime state)
- **Buffer memory:** ~500 KB (render queue + AEC buffers)

## Testing Checklist

- [ ] `bindings` package installed (`npm install bindings`)
- [ ] `AECProcessor.ts` created in `src/main/audio/native/`
- [ ] `AudioService.ts` imports AECProcessor and initializes it
- [ ] `audioHandlers.ts` feeds system audio to render path
- [ ] `audioHandlers.ts` processes capture audio through AEC
- [ ] `AudioService.stop()` calls `aecProcessor.destroy()`
- [ ] Console shows: `✅ WebRTC AEC processor initialized`
- [ ] AEC metrics logged every 5 seconds
- [ ] Native module exists at `native/build/Release/audio_capture_native.node`

## Debugging

### Enable AEC Logging

Set environment variable to see detailed logs:

```bash
DEBUG=*:AEC npm run dev:electron
```

### Monitor Metrics in Real-Time

Add to console:

```typescript
setInterval(() => {
  const metrics = audioService?.getAECMetrics();
  if (metrics?.erle !== undefined) {
    console.log(`[AEC] ERLE: ${metrics.erle.toFixed(1)} dB`);
  }
}, 2000);
```

### Verify Audio Format

Check that audio arriving at AEC is correct format:

```typescript
if (samples instanceof Float32Array && samples.length > 0) {
  const rms = Math.sqrt(
    samples.reduce((sum, s) => sum + s * s, 0) / samples.length
  );
  console.log(`Audio RMS: ${rms.toFixed(4)} (range: 0-1)`);
  console.log(`Sample count: ${samples.length} (duration: ${(samples.length / 48000 * 1000).toFixed(1)} ms)`);
}
```

## References

- **Native Module:** WebRTC audio_processing (EchoCanceller3)
- **AEC Algorithm:** NLMS-based echo cancellation with render delay compensation
- **Standard:** ITU-T G.164 echo cancellation
- **Typical echo tail:** 128–256 ms (configured in native module)

## FAQ

**Q: Why feed system audio to AEC if it's not used directly?**
A: AEC needs to "learn" what audio is playing to speakers so it can remove it from the microphone signal. This render stream is the reference; it's not sent to transcription.

**Q: Can I disable AEC on headphones?**
A: Yes, set `disableAecOnHeadphones: true` in AECConfig. When headphones are detected, AEC is bypassed (no echo expected).

**Q: What if render audio arrives late?**
A: AEC handles render delay up to ~256 ms (configurable). If delays are longer, echo suppression may degrade. The `renderDelayMs` metric shows the estimated delay.

**Q: How long until AEC converges?**
A: Typically 1–3 seconds. Initial ERLE may be 5–10 dB; after convergence, 15–20+ dB.

**Q: Can I process multiple microphones?**
A: Current implementation supports one mic path. For multi-mic, would need separate AEC instances per mic.

**Q: What about noise suppression?**
A: Enabled by default (`enableNs: true`). Can be tuned or disabled if needed.

**Q: Is AGC recommended?**
A: Not for transcription (default: off). AGC can flatten dynamics. For voice calls, may enable.

---

## Summary

The WebRTC AEC integration provides **real-time echo cancellation** to prevent microphone capture of speaker audio. Key points:

1. **Dual-path processing:** Render (system) path for reference, capture (mic) path for echo removal
2. **Transparent fallback:** If AEC fails, system continues with raw audio
3. **Metrics monitoring:** Built-in ERLE/RERL tracking for quality assurance
4. **Proper cleanup:** AEC resources freed on stop
5. **Configurable:** Can adjust suppression, noise filtering, etc.

When working correctly, users should **not hear speaker audio in microphone transcription**, even without headphones.
