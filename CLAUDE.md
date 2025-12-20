# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kakarot is an Electron-based AI meeting assistant that captures dual audio (microphone + system), transcribes in real-time via AssemblyAI, detects questions, and provides contextual response suggestions using OpenAI.

## Development Commands

```bash
# Development (Vite + Electron with hot reload)
npm run dev:electron

# Type checking only
npm run typecheck

# Linting
npm run lint

# Production build (outputs to release/)
npm run build
```

## Architecture

### Process Model

Electron three-process architecture:
- **Main process** (`src/main/`): Node.js backend - audio capture, transcription, storage, AI services
- **Renderer process** (`src/renderer/`): React UI running in Chromium
- **Preload** (`src/preload/`): Secure IPC bridge exposing `window.kakarot` API

### IPC Communication Pattern

All main<->renderer communication uses typed IPC channels defined in `src/shared/ipcChannels.ts`. The preload script (`src/preload/index.ts`) exposes the `window.kakarot` API with these domains:
- `recording` - start/stop/pause/resume controls
- `audio` - level monitoring, data streaming
- `transcript` - real-time updates from AssemblyAI
- `meetings` - CRUD, search, summarize, export
- `callout` - question detection overlay
- `settings` - API keys, preferences
- `knowledge` - RAG indexing and search

### Main Process Services

Located in `src/main/services/`:
- `AudioService` - Captures mic + system audio via electron-audio-loopback
- `TranscriptionService` - AssemblyAI streaming WebSocket connection
- `CalloutService` - Question detection + OpenAI response generation
- `StorageService` - SQLite persistence (sql.js)
- `KnowledgeService` - RAG search over local documents

### Renderer Structure

React 18 + Zustand for state (`src/renderer/stores/appStore.ts`). Three main views:
- `RecordingView` - Live recording UI with transcript display
- `HistoryView` - Past meetings browser
- `SettingsView` - API keys and preferences

Floating `CalloutOverlay` component renders in separate Electron window.

### Path Aliases

Configured in both `tsconfig.json` and `vite.config.ts`:
- `@/*` -> `src/*`
- `@main/*` -> `src/main/*`
- `@renderer/*` -> `src/renderer/*`
- `@shared/*` -> `src/shared/*`

## Key Files

- `src/main/ipc.ts` - Central IPC handler registration, orchestrates services
- `src/shared/types.ts` - Shared TypeScript interfaces (Meeting, Callout, Settings)
- `src/shared/ipcChannels.ts` - Type-safe IPC channel constants
- `src/preload/index.ts` - Renderer API surface + global type declarations

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `ASSEMBLYAI_API_KEY` - Real-time transcription
- `OPENAI_API_KEY` - Callout generation and summaries

## Platform Requirements

- macOS 13.2+ (for system audio loopback)
- Windows 10+
- Node.js 18+
