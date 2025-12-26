# CLAUDE.md

Claude Code guidance for this repository. See [AGENTS.md](./AGENTS.md) for full architecture and style guide.

## Quick Reference

```bash
npm run dev:electron  # Development with hot reload
npm run typecheck     # Type checking
npm run lint          # Linting
npm run build         # Production build
```

## Must Follow

- Read AGENTS.md before making changes
- Run `npm run typecheck && npm run lint` before any commit
- Sign all commits with `-s` flag
- Use conventional commit format: `type(scope): subject`
- No `any` types, no implicit returns on exported functions
- Use path aliases: `@main/`, `@renderer/`, `@shared/`

## Do Not

- Create new files unless absolutely necessary
- Add dependencies without discussion
- Skip error handling
- Use relative imports across process boundaries
- Commit without running type/lint checks

## Process Boundaries

- `src/main/` - Node.js (has `fs`, `path`, native modules)
- `src/renderer/` - Browser (no Node APIs, uses `window.kakarot`)
- `src/shared/` - Pure TypeScript (no Node or browser APIs)
- Never import main from renderer or vice versa

## When Stuck

1. Check `src/shared/types.ts` for data shapes
2. Check `src/shared/ipcChannels.ts` for IPC patterns
3. Check `src/main/core/container.ts` for available services
4. Check `src/main/config/constants.ts` for configuration
