# Acoustic Echo Cancellation (AEC) Implementation

## Status: Implemented

This document describes the Acoustic Echo Cancellation feature implemented in Kakarot.

## Problem

When users take meetings on speakers, the microphone picks up audio playing through the speakers, causing duplicate transcription. The same speech gets transcribed twice:
1. Once from the digital system audio stream
2. Once from the mic picking up the speaker output acoustically

## Solution

AEC uses the system audio as a "reference signal" to subtract echo from microphone input:

```
System Audio (reference) ────┐
                             │
                       ┌─────▼─────┐
Mic Audio (with echo) ─┤    AEC    ├─> Clean Mic Audio (echo removed)
                       └───────────┘
```

## Architecture

### Design Principles

1. **Pipeline Pattern** - Chain of audio processors, each with single responsibility
2. **Graceful Degradation** - Auto-bypass when native module unavailable or headphones detected
3. **Event-Driven** - Processors emit bypass/error/metrics events

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Main Process                                  │
│                                                                          │
│  Renderer ──[IPC: mic audio]──> recordingHandlers.ts                    │
│                                      │                                   │
│                                      │ feedMicReference()               │
│                                      ▼                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       SystemAudioService                            │ │
│  │                                                                      │ │
│  │  ┌─────────────────┐     ┌────────────────────────────────────┐    │ │
│  │  │ Platform Backend │     │         AudioPipeline              │    │ │
│  │  │ (audiotee)       │     │                                    │    │ │
│  │  └────────┬────────┘     │  ┌────────────────────────────┐   │    │ │
│  │           │               │  │      AECProcessor          │   │    │ │
│  │           │ system audio  │  │                            │   │    │ │
│  │           └──────────────>│  │  ┌──────────────────────┐  │   │    │ │
│  │                           │  │  │ Native Rust Module   │  │   │    │ │
│  │                           │  │  │ (kakarot-aec)        │  │   │    │ │
│  │                           │  │  │                      │  │   │    │ │
│  │                           │  │  │ aec-rs + SpeexDSP    │  │   │    │ │
│  │                           │  │  └──────────────────────┘  │   │    │ │
│  │                           │  └────────────────────────────┘   │    │ │
│  │                           └────────────────────────────────────┘    │ │
│  │                                         │                            │ │
│  │                                         ▼                            │ │
│  │                              Transcription (clean audio)             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Files

### TypeScript (src/main/services/audio/)

| File | Description |
|------|-------------|
| `processing/IAudioProcessor.ts` | Base interface and EventEmitter-based abstract class |
| `processing/AudioPipeline.ts` | Sequential processor chain with automatic bypass on failure |
| `processing/AECProcessor.ts` | AEC implementation wrapping native Rust module |
| `processing/index.ts` | Barrel exports |
| `HeadphoneDetector.ts` | Platform-specific headphone detection |

### Rust Native Module (native/kakarot-aec/)

| File | Description |
|------|-------------|
| `Cargo.toml` | Rust dependencies (aec-rs, neon) |
| `src/lib.rs` | Neon bindings exposing create/feedReference/process/getMetrics/reset |
| `index.node` | Compiled native module (platform-specific) |

### Modified Files

| File | Changes |
|------|---------|
| `src/main/services/SystemAudioService.ts` | Added pipeline, feedMicReference(), getTimestamp() |
| `src/main/handlers/recordingHandlers.ts` | Creates AECProcessor, feeds mic reference |
| `src/main/config/constants.ts` | Added AEC_CONFIG section |

## Configuration

In `src/main/config/constants.ts`:

```typescript
export const AEC_CONFIG = {
  ENABLED: true,                    // Enable AEC processing
  FILTER_LENGTH: 256,               // Adaptive filter length in samples
  REFERENCE_BUFFER_MS: 500,         // Max reference audio buffer age
  HEADPHONE_BYPASS: true,           // Auto-bypass when headphones detected
  METRICS_INTERVAL_FRAMES: 100,     // Emit metrics every N frames
} as const;
```

## Native Module API

The Rust module exports:

```typescript
interface NativeAECModule {
  create(sampleRate: number, frameSize: number, filterLength: number): Handle;
  feedReference(handle: Handle, buffer: Buffer): void;
  process(handle: Handle, buffer: Buffer): Buffer;
  getMetrics(handle: Handle): { totalFrames: number; processingTimeUs: number };
  reset(handle: Handle): void;
}
```

## Building the Native Module

```bash
cd native/kakarot-aec
cargo build --release
cp target/release/libkakarot_aec.dylib index.node  # macOS
# cp target/release/kakarot_aec.dll index.node     # Windows
# cp target/release/libkakarot_aec.so index.node   # Linux
```

## Graceful Degradation

AEC automatically bypasses in these scenarios:

1. **Native module not found** - Logs warning, continues without AEC
2. **Headphones detected** - Skips AEC since echo isn't a problem
3. **Processing error** - Falls back to unprocessed audio

The app remains fully functional without AEC.

## Headphone Detection

Platform-specific detection:

| Platform | Method |
|----------|--------|
| macOS | `system_profiler SPAudioDataType` looking for headphone/airpod keywords |
| Windows | PowerShell WMI query for audio endpoints |
| Linux | `pactl list sinks` or `pw-cli list-objects` |

## Performance

- Processing time: ~39 microseconds per frame (well under real-time budget)
- Frame size: 12288 samples at 48kHz (~256ms per frame)
- Filter length: 256 samples

## Future Improvements

1. Add noise suppression processor to pipeline
2. Add automatic gain control (AGC)
3. Add voice activity detection (VAD)
4. Windows/Linux CI/CD for native module builds
5. electron-builder config to bundle native module in production
