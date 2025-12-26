# Contributing to Kakarot

## Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your API keys
4. Run development server: `npm run dev:electron`

## Development Workflow

### Before You Code

- Check existing issues for duplicates
- For significant changes, open an issue first to discuss
- Assign yourself to the issue you're working on

### While Coding

- Follow the code style in [AGENTS.md](./AGENTS.md)
- Keep changes focused - one feature/fix per PR
- Write meaningful commit messages (see commit conventions below)
- Run checks before committing:
  ```bash
  npm run typecheck
  npm run lint
  ```

### Submitting Changes

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes with atomic commits
3. Push and open a pull request
4. Fill out the PR template
5. Address review feedback

## Commit Conventions

We use conventional commits. Format:

```
<type>(<scope>): <subject>

<body>

Signed-off-by: Your Name <your@email.com>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

**Scopes**: `main`, `renderer`, `shared`, `audio`, `transcription`, `callout`, `ui`

**Example**:
```
feat(callout): add confidence threshold setting

Allow users to configure minimum confidence for displaying
AI-generated callouts. Defaults to 0.7.

Signed-off-by: Jane Doe <jane@example.com>
```

Always sign commits: `git commit -s`

## Code Style

See [AGENTS.md](./AGENTS.md) for detailed code style guidelines. Key points:

- TypeScript strict mode - no implicit `any`
- Functional React components only
- Use path aliases (`@main/`, `@renderer/`, `@shared/`)
- Structured logging via `@main/core/logger.ts`
- Icons from `lucide-react` only

## Project Structure

```
src/
├── main/          # Electron main process (Node.js)
├── renderer/      # React UI (Chromium)
├── preload/       # IPC bridge
└── shared/        # Types and utilities shared between processes
```

## Testing

Currently manual testing. When running the app:

- Test microphone capture with different input devices
- Test system audio capture (macOS: requires permissions)
- Verify transcription appears in real-time
- Check callouts appear for detected questions
- Test meeting save/load/export

## Getting Help

- Check existing issues and discussions
- Read the architecture docs in AGENTS.md
- Open an issue with the `question` label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
