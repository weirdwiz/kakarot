#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Kakarot Audio Native Module Setup ==="

# Check dependencies
command -v meson >/dev/null 2>&1 || { echo "Error: meson not found. Install with: pip install meson"; exit 1; }
command -v ninja >/dev/null 2>&1 || { echo "Error: ninja not found. Install with: brew install ninja"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }

# Initialize submodule if needed
if [ ! -f "deps/webrtc-audio-processing/meson.build" ]; then
    echo "Initializing git submodule..."
    cd "$SCRIPT_DIR/../.."
    git submodule update --init --recursive native/kakarot-audio/deps/webrtc-audio-processing
    cd "$SCRIPT_DIR"
fi

# Build webrtc-audio-processing
WEBRTC_SRC="deps/webrtc-audio-processing"
WEBRTC_INSTALL="deps/webrtc-2.0-install"

# Check if we need to build (need both the library AND the build dir with abseil)
ABSEIL_BUILD_DIR="$WEBRTC_SRC/build/subprojects/abseil-cpp-20240722.0"
if [ ! -f "$WEBRTC_INSTALL/lib/libwebrtc-audio-processing-2.a" ] || [ ! -d "$ABSEIL_BUILD_DIR" ]; then
    echo "Building webrtc-audio-processing..."
    cd "$WEBRTC_SRC"

    # Clean previous build if exists
    rm -rf build

    # Configure with meson
    meson setup build \
        --prefix="$SCRIPT_DIR/$WEBRTC_INSTALL" \
        --default-library=static \
        --buildtype=release

    # Build and install
    meson compile -C build
    meson install -C build

    cd "$SCRIPT_DIR"
    echo "webrtc-audio-processing built successfully"
else
    echo "webrtc-audio-processing already built, skipping..."
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Build native module
echo "Building native module..."
npm run build

echo ""
echo "=== Setup complete ==="
echo "Native module built at: build/Release/kakarot_audio.node"
