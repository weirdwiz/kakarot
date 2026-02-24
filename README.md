# Treeto

> Your AI meeting copilot. Capture every word, surface what matters.

Treeto is a desktop app that records your meetings, transcribes them in real-time, generates structured notes, and prepares you for upcoming calls using past context. It works locally on your machine -- your audio and transcripts never leave your control.

```
         ___
        /   \       "What did they say about the deadline?"
       | o o |
        \ - /       Treeto heard it. Treeto remembers.
     ___/   \___
    /   TREETO  \
```

---

## What it does

- Captures microphone and system audio separately (you vs everyone else)
- Real-time transcription via AssemblyAI or Deepgram streaming
- Acoustic echo cancellation using WebRTC AEC3 (native C++ module)
- Detects questions during meetings and surfaces response suggestions
- Generates structured notes: topics, action items, decisions, risks
- Meeting prep using past conversation history with attendees
- CRM integration (Salesforce, HubSpot) for automatic note pushing
- Calendar integration (Google, Outlook, iCloud) for upcoming meeting context
- Local SQLite database -- everything stays on your machine

## Requirements

- Node.js 18+ (see `.nvmrc`)
- macOS 13.2+ or Windows 10+
- Python 3 + node-gyp (for native AEC module, optional)

## Quick start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Add your API keys to .env

# Run in development mode
npm run dev
```

## Building native AEC module (optional)

The acoustic echo cancellation module improves transcription quality when using speakers instead of headphones. Without it, the app still works fine.

```bash
cd native
npm install
npm run build    # produces audio_capture_native.node
cd ..
```

## Development commands

```bash
npm run dev          # Vite + Electron with hot reload
npm run dev:all      # App + backend server
npm run build        # Production build
npm run dist         # Build + package for distribution
npm run typecheck    # Type checking (tsc --noEmit)
npm run lint         # ESLint
npm run test         # Run tests
```

## Architecture

```
src/
+-- main/               Electron main process (Node.js)
|   +-- handlers/        IPC handlers by domain
|   +-- services/        Business logic
|   +-- data/            SQLite via sql.js
|   +-- providers/       AI provider clients (OpenAI, Gemini)
|   +-- audio/           AEC and audio processing
|   +-- prompts/         LLM prompt templates
|   +-- windows/         Electron window management
|   +-- core/            Logger, DI container, error handling
|
+-- renderer/            React UI (Chromium)
|   +-- components/      Views and UI components
|   +-- stores/          Zustand state management
|
+-- shared/              Types, IPC channels, utilities
+-- preload/             Secure IPC bridge (window.kakarot API)
```

**Three-process model:**

1. Main process -- audio capture, transcription, AI calls, database
2. Renderer process -- React UI running in Chromium
3. Preload -- typed IPC bridge between main and renderer

## Audio pipeline

```
System Audio (audiotee)  -->  AEC Reference
                                   |
Microphone (AudioUnit)   -->  AEC Processor  -->  Clean Audio  -->  Transcription
                              (WebRTC AEC3)                        (AssemblyAI/Deepgram)
```

1. System audio captured via audiotee (macOS loopback)
2. Microphone captured via native AudioUnit or Web Audio API
3. AEC removes speaker audio bleeding into the mic
4. Both clean streams sent to transcription provider
5. Transcripts labeled by source for speaker identification

## Tech stack

| Layer | Tech |
|-------|------|
| Shell | Electron 33 |
| Frontend | React 18, Tailwind CSS, Zustand |
| Build | Vite + vite-plugin-electron |
| Packaging | electron-builder |
| Audio capture | audiotee (macOS), Web Audio API |
| Echo cancellation | C++ / WebRTC AEC3 (native addon) |
| Transcription | AssemblyAI, Deepgram |
| AI | OpenAI, Google Gemini |
| Database | sql.js (SQLite compiled to WASM) |
| Calendar | Google Calendar, Outlook, iCloud (CalDAV) |
| CRM | Salesforce (JSForce), HubSpot API |

## Code quality

- TypeScript strict mode with `noUnusedLocals`, `noImplicitReturns`
- ESLint with `no-explicit-any` and `exhaustive-deps` as errors
- Prettier for formatting
- Pre-commit hooks via husky + lint-staged
- Content Security Policy enforced in production builds
- Single-instance lock prevents duplicate app launches
- Error boundaries in React for graceful crash recovery

## Project structure

```
.
+-- src/                 Application source
+-- native/              C++ AEC native addon (node-gyp)
+-- resources/           App icons, entitlements, platform assets
+-- treeto-backend/      Backend API server (workspace)
+-- electron-builder.yml Build/packaging configuration
+-- vite.config.ts       Vite + Electron plugin config
```

## License

MIT
