# Kakarot AI Coding Instructions

## Project Overview
Kakarot is an Electron-based AI meeting assistant that captures dual audio streams (microphone + system), transcribes in real-time via AssemblyAI, detects questions via LLM analysis, and generates contextual response suggestions using OpenAI.

## Three-Process Architecture

**Main Process** (`src/main/`) - Node.js backend:
- Audio capture and transcription orchestration
- SQLite data persistence (via sql.js)
- Service layer for business logic
- IPC handler registration

**Renderer** (`src/renderer/`) - React UI:
- Real-time recording controls and transcript display
- Meeting history browser and search
- Settings and configuration UI
- Zustand store for client-side state

**Preload** (`src/preload/`) - Secure IPC bridge:
- Exposes `window.kakarot` API to renderer
- Validates and sanitizes IPC calls

## Core Patterns & Conventions

### Dependency Injection via Container
All services access dependencies through `getContainer()` from `src/main/core/container.ts`:
```typescript
const { aiProvider, meetingRepo, calloutService } = getContainer();
```
Container is initialized in main process after database setup. If you need a new service, add it to `AppContainer` interface and initialize in `initializeContainer()`.

### IPC Communication
- **Type-safe channels**: Define in `src/shared/ipcChannels.ts` with `IPC_CHANNELS` constant
- **Handler pattern**: Each domain has a `register*Handlers` function in `src/main/handlers/`
- **No long-running requests**: Audio streaming uses one-way events; other calls should resolve quickly or emit progress events

### Repository Pattern
Data access via repositories in `src/main/data/repositories/`. Each model (Meeting, Callout, Settings) has its own repo. All schema changes go through database migrations in `src/main/data/database.ts`.

### Logging
Use `createLogger()` from `src/main/core/logger.ts`:
```typescript
const logger = createLogger('ComponentName');
logger.info('message', { context: 'data' });
```

### Prompt Engineering
LLM prompts isolated in `src/main/prompts/`. Import and use in services. Keep prompts parametrized for testing.

### Path Aliases
- `@/*` → `src/*`
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`

## Critical Files

| File | Purpose |
|------|---------|
| `src/shared/types.ts` | Core TypeScript interfaces: Meeting, Callout, TranscriptSegment |
| `src/main/core/container.ts` | DI container initialization and getContainer() |
| `src/shared/ipcChannels.ts` | Typed IPC channel constants |
| `src/main/data/database.ts` | SQLite schema and initialization |
| `src/main/handlers/index.ts` | Registers all IPC handler modules |
| `src/renderer/stores/appStore.ts` | Zustand state management |
| `src/main/config/constants.ts` | Magic numbers, patterns, defaults |

## Development Commands

```bash
npm run dev:electron      # Start dev server (Vite + hot reload)
npm run typecheck         # Type checking only
npm run lint              # ESLint
npm run build             # Production build → release/
```

Note: `npm run dev` runs Vite only; use `dev:electron` to run the full Electron app.

## Configuration & Environment

- Copy `.env.example` to `.env`
- Required: `ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY`
- Settings also stored in SQLite via SettingsRepository

## Common Workflows

**Adding a new IPC handler:**
1. Define channel constant in `src/shared/ipcChannels.ts`
2. Create handler function in appropriate `*Handlers.ts` file
3. Register in that file's `register*` function
4. Call from renderer via `window.kakarot.invoke()`

**Modifying database schema:**
1. Update interface in `src/shared/types.ts`
2. Alter table or create migration in `src/main/data/database.ts`
3. Update repository methods in `src/main/data/repositories/*`

**Adding AI features:**
1. Create prompt template in `src/main/prompts/`
2. Add method to `CalloutService` or new service
3. Expose via IPC handler if needed by renderer

## Shared Utilities
Location: `src/shared/utils/formatters.ts`
- `formatTimestamp(ms)` - Converts milliseconds to MM:SS
- `formatDuration(ms)` - Formats with hours if duration > 1 hour
- `getSpeakerLabel(source)` - Maps 'mic'/'system' to 'You'/'Other'

## Platform-Specific Notes
- **macOS**: System audio capture requires macOS 13.2+; handles via electron-audio-loopback
- **Windows**: Works on Windows 10+; may need Stereo Mix enabled
