# kakarot-aec

Acoustic Echo Cancellation native module for Kakarot using aec-rs (SpeexDSP bindings).

## Purpose

Removes speaker audio that bleeds into the microphone when users take meetings on speakers instead of headphones. This prevents duplicate transcription of the same speech.

## Building

Requires Rust toolchain.

```bash
# Build release version
cargo build --release

# Copy to index.node for Node.js loading
cp target/release/libkakarot_aec.dylib index.node  # macOS
cp target/release/kakarot_aec.dll index.node       # Windows
cp target/release/libkakarot_aec.so index.node     # Linux

# Or use npm script
npm run build
```

## API

The module exports these functions via Neon bindings:

### create(sampleRate, frameSize, filterLength)

Creates an AEC processor instance.

- `sampleRate`: Audio sample rate in Hz (e.g., 48000)
- `frameSize`: Samples per frame (e.g., 12288)
- `filterLength`: Adaptive filter length (e.g., 256)
- Returns: Opaque handle object

### feedReference(handle, buffer)

Feeds reference audio (mic/far-end) to the AEC for echo estimation.

- `handle`: Handle from create()
- `buffer`: Buffer containing 16-bit PCM samples (little-endian)

### process(handle, buffer)

Processes system audio, removing echo based on fed reference.

- `handle`: Handle from create()
- `buffer`: Buffer containing 16-bit PCM samples
- Returns: Buffer with echo-cancelled audio

### getMetrics(handle)

Returns processing metrics.

- `handle`: Handle from create()
- Returns: `{ totalFrames: number, processingTimeUs: number }`

### reset(handle)

Resets the AEC processor state.

- `handle`: Handle from create()

## Usage Example

```javascript
const aec = require('./index.node');

// Create processor for 48kHz audio
const handle = aec.create(48000, 12288, 256);

// Feed mic audio as reference
aec.feedReference(handle, micBuffer);

// Process system audio to remove echo
const cleanAudio = aec.process(handle, systemBuffer);

// Check metrics
const metrics = aec.getMetrics(handle);
console.log(`Processed ${metrics.totalFrames} frames in ${metrics.processingTimeUs}us`);

// Reset when done
aec.reset(handle);
```

## Dependencies

- `aec-rs` - Rust bindings for SpeexDSP echo cancellation
- `neon` - Node.js native module bindings for Rust

## Performance

- Processing time: ~39 microseconds per frame
- Frame size: Up to 16384 samples
- Filter length: 64-2048 samples

## Integration

The TypeScript wrapper is in `src/main/services/audio/processing/AECProcessor.ts`. It handles:

- Dynamic module loading from multiple paths
- Graceful fallback if module unavailable
- Headphone detection to skip AEC when not needed
- Metrics emission for monitoring

## License

MIT
