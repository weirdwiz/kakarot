# Kakarot cleanup tracker

Status: IN PROGRESS (28/31 done)
Started: 2026-02-25

## Critical

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 1 | Remove committed API keys from .env | DONE (not tracked) | .env |
| 2 | Fix SystemAudioService listener leak | DONE | SystemAudioService.ts |
| 3 | Remove hardcoded dev paths from AECProcessor | DONE | AECProcessor.ts |

## High - config and build

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 4 | Consolidate electron-builder config | DONE | electron-builder.json5 deleted |
| 5 | Harden CSP for production | DONE | mainWindow.ts |
| 6 | Strengthen ESLint rules, add Prettier | DONE | eslint.config.mjs, .prettierrc.json |
| 7 | Enable strict TypeScript compiler options | DONE | tsconfig.json |
| 8 | Fix package.json (engines, scripts) | DONE | package.json, CLAUDE.md |
| 9 | Add .nvmrc | DONE | .nvmrc |
| 10 | Clean up .gitignore | DONE | .gitignore |

## High - React code quality

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 11 | Add React ErrorBoundary | DONE | ErrorBoundary.tsx, App.tsx |
| 12 | Fix any types for attendees | DONE | types.ts, formatters.ts, 6 components |
| 13 | Fix array index keys (chat messages) | DONE | HistoryView.tsx |
| 14 | Fix Zustand store re-renders (useShallow) | DONE | App.tsx |
| 15 | Fix useEffect infinite loop | DONE (not a bug) | Already correct |
| 16 | Fix silent error catches in stores | DONE | appStore.ts, onboardingStore.ts |

## High - Electron main process

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 17 | Add single-instance lock | DONE | index.ts |
| 18 | Add async saveDatabase + error handling | DONE | database.ts |
| 19 | Add try-catch to JSON.parse in settings | DONE | SettingsRepository.ts |
| 20 | Add OAuth window timeouts (5 min) | DONE | SlackHandlers, Salesforce, HubSpot |
| 21 | Move Slack IPC to constants | DONE | SlackHandlers.ts, ipcChannels.ts, preload |

## Medium

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 22 | Fix ToggleSwitch accessibility | DONE | SettingsView.tsx |
| 23 | Add saveDatabase error handling | DONE | database.ts |
| 24 | Timer leak audit | DONE (not a bug) | Properly cleaned in stop |
| 27 | Fix postcss.config.cjs permissions | DONE | postcss.config.cjs |
| 30 | Graceful shutdown audit | DONE | Already handled by RecoveryService |
| 31 | Remove unnecessary files | DONE | Worktree, old docs, backup deleted |

## Remaining (need design/user input)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 25 | Service disposal pattern | DEFERRED | Needs IDisposable interface design |
| 26 | Pre-commit hooks (eslint + prettier) | DONE | husky, lint-staged |
| 28 | Database schema versioning | DEFERRED | Needs migration system design |
| 29 | Log redaction | DEFERRED | Needs redaction pattern design |
