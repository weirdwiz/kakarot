# kakarot-audio

Native audio capture module for Kakarot with WebRTC AEC3 echo cancellation.

## Features

- Synchronized dual-stream capture (microphone + system audio)
- WebRTC AEC3 acoustic echo cancellation
- Automatic sample rate conversion (44.1kHz mic to 48kHz)
- Headphone bypass (AEC disabled when not needed)

## Requirements

- macOS 13.0+ (for ScreenCaptureKit system audio)
- Node.js 18+
- Python 3 (for meson build system)
- meson and ninja build tools

## Setup

### 1. Install build dependencies

```bash
# macOS
brew install meson ninja

# Or with pip
pip install meson ninja
```

### 2. Clone with submodules

```bash
git clone --recursive https://github.com/user/kakarot.git
# Or if already cloned:
git submodule update --init --recursive
```

### 3. Build

```bash
cd native/kakarot-audio
./setup.sh
```

This will:
1. Build webrtc-audio-processing library from submodule
2. Install npm dependencies
3. Compile the native Node.js addon

## Manual Build

If the setup script doesn't work, build manually:

```bash
cd native/kakarot-audio

# Build webrtc-audio-processing
cd deps/webrtc-audio-processing
meson setup build --prefix=$(pwd)/../webrtc-2.0-install --default-library=static --buildtype=release
meson compile -C build
meson install -C build
cd ../..

# Build native module
npm install
npm run build
```

## Usage

```typescript
const audio = require('./build/Release/kakarot_audio.node');

const handle = audio.create({
  sampleRate: 48000,
  chunkDurationMs: 256,
  enableAEC: true,
});

audio.setCallback(handle, (frame) => {
  if (frame.hasMic) {
    // Process mic audio (echo-cancelled)
  }
  if (frame.hasSystem) {
    // Process system audio
  }
});

await audio.start(handle);
// ... recording ...
audio.stop(handle);
audio.destroy(handle);
```

## How AEC Works

The module uses WebRTC's AEC3 algorithm with a 100ms mic delay buffer:

1. System audio is captured via ScreenCaptureKit and fed to AEC as reference
2. Mic audio is buffered for 100ms before processing
3. This delay allows AEC3 to receive reference audio before the echo appears
4. Result: 10-13 dB ERLE (90-95% echo reduction)

## License

MIT
