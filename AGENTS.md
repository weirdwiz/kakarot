# AGENTS.md

This file provides guidance to AI coding assistants (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

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

## Code Style

### TypeScript

- Strict mode enabled - no `any` types without justification
- Prefer `interface` over `type` for object shapes
- Use explicit return types on exported functions
- Destructure imports: `import { foo } from 'bar'` not `import * as bar`
- Path aliases required: `@main/`, `@renderer/`, `@shared/` - never relative paths crossing process boundaries

### Naming Conventions

- Files: `PascalCase.ts` for classes/components, `camelCase.ts` for utilities
- Variables/functions: `camelCase`
- Classes/interfaces/types: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for config objects
- IPC channels: `kebab-case` (e.g., `recording:start`, `meeting:save`)

### React Components

- Functional components only (no class components)
- Props interface named `{ComponentName}Props`
- Hooks at top of component, no conditional hooks
- Use Zustand for global state, local state for component-specific UI state
- Icons from `lucide-react` only

### Error Handling

- Never swallow errors silently
- Use structured logging via `@main/core/logger.ts`
- Wrap async IPC handlers in try/catch with proper error propagation
- User-facing errors should be actionable, not technical

## Commit Conventions

### Format

```
<type>(<scope>): <subject>

<body>

Signed-off-by: Name <email>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc (no code change)
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

### Scopes

- `main`: Main process code
- `renderer`: Renderer process code
- `shared`: Shared types/utilities
- `audio`: Audio capture/processing
- `transcription`: Transcription services
- `callout`: AI callout system
- `ui`: UI components

### Examples

```
feat(transcription): add speaker diarization support

Implement speaker identification using AssemblyAI's diarization API.
Maps speakers to mic/system audio sources for accurate attribution.

Signed-off-by: Your Name <your@email.com>
```

```
fix(audio): handle microphone permission denial gracefully

Previously crashed on permission denial. Now shows user-friendly
error with instructions to enable in System Preferences.

Signed-off-by: Your Name <your@email.com>
```

### Rules

- Subject line: imperative mood, lowercase, no period, max 50 chars
- Body: wrap at 72 chars, explain what and why (not how)
- Always sign commits with `-s` flag
- One logical change per commit
- Run `npm run typecheck && npm run lint` before committing

## Architecture

### Process Model

Electron three-process architecture:
- **Main process** (`src/main/`): Node.js backend - audio capture, transcription, storage, AI services
- **Renderer process** (`src/renderer/`): React UI running in Chromium
- **Preload** (`src/preload/`): Secure IPC bridge exposing `window.kakarot` API

### Main Process Structure

```
src/main/
├── index.ts              # Entry point, app lifecycle
├── core/                 # Infrastructure
│   ├── logger.ts         # Structured logging (debug/info/warn/error)
│   └── container.ts      # Dependency injection container
├── handlers/             # IPC handlers by domain
│   ├── index.ts          # Registers all handlers
│   ├── recordingHandlers.ts
│   ├── meetingHandlers.ts
│   ├── settingsHandlers.ts
│   └── calloutHandlers.ts
├── data/                 # Data access layer
│   ├── database.ts       # SQLite connection (sql.js)
│   └── repositories/     # Repository pattern
│       ├── MeetingRepository.ts
│       ├── CalloutRepository.ts
│       └── SettingsRepository.ts
├── services/             # Business logic
│   ├── CalloutService.ts
│   ├── KnowledgeService.ts
│   ├── SystemAudioService.ts
│   └── ExportService.ts
├── providers/            # External API clients
│   └── OpenAIProvider.ts # Centralized OpenAI client
├── prompts/              # LLM prompt templates
│   ├── calloutPrompts.ts
│   └── summaryPrompts.ts
├── config/               # Constants and configuration
│   └── constants.ts      # All magic numbers, patterns, defaults
└── windows/              # Electron window management
    ├── mainWindow.ts
    └── calloutWindow.ts
```

### Dependency Injection

Services access dependencies via `getContainer()` from `src/main/core/container.ts`:
- `aiProvider` - OpenAIProvider instance
- `meetingRepo`, `calloutRepo`, `settingsRepo` - Data repositories
- `knowledgeService`, `calloutService` - Business services

### IPC Communication Pattern

All main<->renderer communication uses typed IPC channels defined in `src/shared/ipcChannels.ts`. Handlers are organized by domain in `src/main/handlers/`:
- `recordingHandlers` - start/stop/pause/resume, audio streaming
- `meetingHandlers` - CRUD, search, summarize, export
- `settingsHandlers` - API keys, preferences
- `calloutHandlers` - dismiss callout

### Renderer Structure

React 18 + Zustand for state (`src/renderer/stores/appStore.ts`). Three main views:
- `RecordingView` - Live recording UI with transcript display
- `HistoryView` - Past meetings browser
- `SettingsView` - API keys and preferences

Icons use `lucide-react` (direct imports). Floating `CalloutOverlay` renders in separate Electron window.

### Shared Utilities

Located in `src/shared/utils/formatters.ts`:
- `formatTimestamp(ms)` - Formats milliseconds as MM:SS
- `formatDuration(ms)` - Formats duration with hours if needed
- `getSpeakerLabel(source)` - Maps 'mic'/'system' to 'You'/'Other'

### Path Aliases

Configured in both `tsconfig.json` and `vite.config.ts`:
- `@/*` -> `src/*`
- `@main/*` -> `src/main/*`
- `@renderer/*` -> `src/renderer/*`
- `@shared/*` -> `src/shared/*`

## Key Files

- `src/main/core/container.ts` - DI container, service initialization
- `src/main/handlers/index.ts` - Registers all IPC handlers
- `src/main/data/database.ts` - SQLite schema and connection
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
