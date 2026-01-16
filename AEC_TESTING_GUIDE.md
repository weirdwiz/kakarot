# WebRTC AEC Integration - Testing & Verification Guide

## Status Summary

✅ **Integration Complete**
- AECProcessor TypeScript wrapper created and functional
- AudioService lifecycle management integrated
- Audio handlers routed through AEC paths (render + capture)
- Dependencies installed (bindings@^1.5.0)
- Vite config updated to externalize bindings module
- Native module compiled successfully

⚠️ **Awaiting WebRTC Library Setup**
- WebRTC audio_processing library needs to be placed in `native/webrtc/`
- See section: "Setting Up WebRTC Library" below

## Quick Start Checklist

- [ ] **Verify native module exists**
  ```bash
  ls -lh build/Release/audio_capture_native.node
  ```
  Expected: File should exist and be ~144KB

- [ ] **Verify bindings installed**
  ```bash
  npm list bindings
  ```
  Expected: `bindings@1.5.0` in output

- [ ] **Run type check**
  ```bash
  npm run typecheck
  ```
  Expected: No errors in AECProcessor.ts

- [ ] **Build TypeScript**
  ```bash
  npx tsc
  ```
  Expected: No compilation errors

- [ ] **Run dev server**
  ```bash
  npm run dev:electron
  ```
  Expected: App starts, console shows "✅ WebRTC AEC processor initialized"

## Setting Up WebRTC Library

### What is Needed

The native module expects WebRTC audio_processing library at:
```
native/webrtc/
├── lib/
│   └── libwebrtc.a          (WebRTC static library, ~17MB)
└── include/
    └── modules/audio_processing/aec3/
        └── echo_canceller3.h (Header file)
```

### Option 1: Download Prebuilt (Recommended)

1. Visit: https://github.com/aspect-build/aspect-webrtc-build/releases
2. Download macOS ARM64 version (aspect-webrtc-macos_arm64.tar.xz)
3. Extract to `native/webrtc/`

```bash
cd native
mkdir -p webrtc
# Extract downloaded tar.xz to webrtc/
tar -xf aspect-webrtc-macos_arm64.tar.xz -C webrtc/
```

### Option 2: Build from Source

If prebuilt unavailable or need custom build:

```bash
# 1. Clone depot_tools (Google's build tool)
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH=$PATH:$(pwd)/depot_tools

# 2. Setup WebRTC checkout
mkdir webrtc-checkout && cd webrtc-checkout
fetch --nohooks webrtc
cd src

# 3. Checkout stable branch
git checkout branch-heads/6099  # Latest stable (M120+)

# 4. Sync dependencies
gclient sync --no-history

# 5. Configure build
gn gen out/Release --args='
  is_debug=false
  rtc_include_tests=false
  use_sysroot=false
  treat_warnings_as_errors=false
'

# 6. Build
ninja -C out/Release

# 7. Copy to Kakarot
cp -r out/Release/obj libwebrtc.a kakarot/native/webrtc/lib/
cp -r api/audio kakarot/native/webrtc/include/
```

### Verification After Setup

```bash
# Verify library file
ls -lh native/webrtc/lib/libwebrtc.a
# Expected: 17-20 MB

# Verify headers
find native/webrtc/include -name "*.h" | wc -l
# Expected: 50+ header files

# Rebuild native module
npm run rebuild:native
# Expected: No linker errors about libwebrtc.a
```

## Testing the Integration

### 1. Type Checking

```bash
npm run typecheck
```

**Expected Output:**
```
✓ No errors
```

**If errors occur:**
- Bindings module not installed → Run `npm install`
- TypeScript config issue → Run `npm run build:vite` to verify

### 2. Build Test

```bash
npm run build:vite
```

**Expected Output:**
```
✓ build complete
```

**If Vite warnings appear:**
```
[vite]: Rollup failed to resolve import "bindings"
```
→ This is **expected**. Bindings is marked as external in vite.config.ts

### 3. Runtime Test

Start the dev server:

```bash
npm run dev:electron
```

**Check console for these logs:**

```
✅ WebRTC AEC processor initialized
  enableAec: true
  enableNs: true
  enableAgc: false
  sampleRate: 48000
  frameDurationMs: 10
```

If you see this, AEC is running! ✅

**If you see errors:**

```
❌ AEC initialization failed: Cannot find native module
```
→ WebRTC library not in `native/webrtc/lib/`

```
❌ AEC initialization failed: Native method not found
```
→ Native module API doesn't match TypeScript interface

### 4. Functional Testing

Once app starts without errors:

#### Test Setup (No Headphones)

1. Open system audio output (Spotify, YouTube, etc.)
2. Start recording in Kakarot
3. Speak into microphone
4. Listen back to transcription

**Expected Result (AEC Working):**
- Microphone captures your speech clearly
- System audio NOT present in transcription
- Speaker voice is isolated from mic

**Symptom (AEC Not Working):**
- System audio appears in mic transcription
- Overlapping speech between you and speaker
- ERLE metrics near 0 dB

#### Monitor AEC Metrics

Add this to `src/main/audio/AudioService.ts` for debugging:

```typescript
// Every 5 seconds, log AEC quality metrics
this.aecMetricsInterval = setInterval(() => {
  const metrics = this.aecProcessor?.getMetrics();
  if (metrics) {
    console.log('[AEC METRICS]', {
      erle_dB: metrics.erle?.toFixed(1),
      rerl_dB: metrics.rerl?.toFixed(1),
      converged: metrics.converged,
      renderDelayMs: metrics.renderDelayMs,
    });
  }
}, 5000);
```

**Expected metric ranges:**

| Metric | Initial | Converged | Interpretation |
|--------|---------|-----------|-----------------|
| ERLE (dB) | 5-10 | 15-25 | Echo suppression strength |
| Converged | false | true | AEC adapted to echo path |
| RenderDelayMs | 5-50 | stable | Estimated delay ms |

**Example healthy output:**
```
[AEC METRICS] {
  erle_dB: '18.5',
  rerl_dB: '22.3',
  converged: true,
  renderDelayMs: 32
}
```

### 5. Integration Points Verification

Run verification script:

```bash
bash scripts/verify-aec-integration.sh
```

**Expected Output:**
```
✅ bindings module installed
✅ AECProcessor.ts found
✅ Native module exists at build/Release/audio_capture_native.node
✅ AudioService imports AECProcessor
✅ AudioService has AEC lifecycle methods
✅ audioHandlers uses processRenderAudio
✅ audioHandlers uses processCaptureAudio
```

## Troubleshooting

### "Cannot find module 'bindings'"

**Cause:** Node module not installed

**Fix:**
```bash
npm install
# or specifically:
npm install bindings@^1.5.0 --save
```

**Verify:**
```bash
ls node_modules/bindings/
# Should list: index.js, build/, etc.
```

### "Failed to load native audio_capture_native module"

**Cause:** Native module not compiled

**Fix:**
```bash
npm run rebuild:native
# or:
npm install  # triggers rebuild
```

**Verify:**
```bash
ls -lh build/Release/audio_capture_native.node
# Should be ~144 KB
```

### "Rollup failed to resolve import 'bindings'"

**Cause:** Missing externalize config in Vite (non-critical warning)

**Status:** Already fixed in vite.config.ts

**Verify:**
```bash
grep -A 15 "rollupOptions:" vite.config.ts | grep bindings
```

Should show: `'bindings',`

### AEC Returns null on processCaptureAudio()

**Cause:** AEC processor not ready or WebRTC library missing

**Diagnosis:**
```typescript
const aec = audioService?.getAECProcessor();
console.log('AEC ready?', aec?.isReady());
console.log('AEC instance:', aec);
```

**Fix:**
1. Ensure WebRTC library in `native/webrtc/lib/`
2. Rebuild native: `npm run rebuild:native`
3. Check logs for initialization errors

### Echo Still Present in Transcription

**Cause:** AEC not converged or audio timing misaligned

**Diagnosis:**
1. Check AEC metrics:
   - ERLE < 5 dB = not converged
   - renderDelayMs varies wildly = timing issue

2. Verify render→capture ordering:
   - System audio must call `processRenderAudio()` BEFORE mic calls `processCaptureAudio()`
   - Check audioHandlers callbacks order

3. Verify audio format:
   - Must be Float32Array
   - Must be 48 kHz sample rate
   - Must be mono (single channel)

**Solution:**
```bash
# 1. Restart app to reset AEC state
npm run dev:electron

# 2. Ensure 2-3 seconds of reference audio before testing
# (AEC needs time to converge)

# 3. Check console for warnings about audio format
```

### AEC Consumes Too Much CPU

**Cause:** Frame duration too small or processing every frame

**Current Config:**
- Frame duration: 10 ms
- Buffer size: ~480 samples @ 48kHz
- Processing frequency: ~100 times/sec

**Optimization:**
```typescript
// In AudioService.initializeAECProcessor():
const aecConfig: AECConfig = {
  frameDurationMs: 20,  // Increase from 10 to 20 ms
  // ... rest unchanged
};
```

**Trade-off:** Larger frame = less overhead but slightly higher latency

## Performance Benchmarks

Expected resource usage during recording:

| Resource | Usage | Notes |
|----------|-------|-------|
| CPU | 2-5% | Single core processing |
| Memory | ~50 MB | WebRTC + buffer state |
| Latency | < 10 ms | Per-frame processing |
| Echo Suppression | 15-25 dB | After 3 second convergence |

## Next Steps

After successful testing:

1. **Optional: Fine-tune AEC settings**
   - Adjust `enableNs` (noise suppression)
   - Adjust `enableAgc` (auto-gain control)
   - Test different `frameDurationMs` values

2. **Monitor in production**
   - Log ERLE metrics for quality tracking
   - Alert if ERLE drops below 10 dB
   - Periodically reset AEC for long calls

3. **User feedback**
   - Test with various speaker/mic combinations
   - Collect echo suppression feedback
   - Adjust if needed

## Reference Files

| File | Purpose |
|------|---------|
| [AECProcessor.ts](../src/main/audio/native/AECProcessor.ts) | TypeScript wrapper for native AEC |
| [AudioService.ts](../src/main/audio/AudioService.ts) | AEC lifecycle management |
| [audioHandlers.ts](../src/main/handlers/audioHandlers.ts) | AEC integration in audio routing |
| [vite.config.ts](../vite.config.ts) | Build config with bindings externalize |
| [verify-aec-integration.sh](../scripts/verify-aec-integration.sh) | Verification script |

## Support

For issues not covered:
1. Check [AEC_INTEGRATION_GUIDE.md](./AEC_INTEGRATION_GUIDE.md) for architecture details
2. Review console logs for error messages
3. Run verification script to check integration completeness
4. Verify WebRTC library is properly installed in `native/webrtc/`

---

**Last Updated:** 2025-01-06
**Integration Status:** ✅ Code Complete, ⏳ Awaiting WebRTC Library Setup
