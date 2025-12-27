# Kakarot - AI Meeting Note Taker

Kakarot is an Electron-based AI meeting assistant that captures audio from your microphone and system, transcribes it in real-time using AssemblyAI, and provides contextual callouts when someone asks you a question.

## Features

- **Real-time Transcription**: Live speech-to-text using AssemblyAI's streaming API
- **Dual Audio Capture**: Captures both microphone (you) and system audio (others) separately
- **Question Detection**: Automatically detects when someone asks you a question
- **Contextual Callouts**: Floating overlay with suggested responses based on:
  - Current conversation context
  - Past meeting transcripts
  - Your local knowledge base (documents, notes)
- **Meeting History**: Searchable repository of all your meetings (Notion-like)
- **Post-Meeting Actions**: AI-generated summaries, action items, and exports
- **Cross-Platform**: Works on macOS 13.2+ and Windows 10+

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Electron Shell                              │
├────────────────────────────────────────────────────────────────────┤
│  Main Process                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Handlers (IPC)                                               │   │
│  │ recordingHandlers | meetingHandlers | settingsHandlers      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Services     │ │ Providers    │ │ Data Layer   │                │
│  │ Callout,     │ │ OpenAI       │ │ Repositories │                │
│  │ Knowledge    │ │ Provider     │ │ (SQLite)     │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
├────────────────────────────────────────────────────────────────────┤
│  Renderer (React + Tailwind)                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ RecordingView   │  │ FloatingCallout │  │ HistoryView        │  │
│  │ (controls/live) │  │ (overlay window)│  │ (search/browse)    │  │
│  └─────────────────┘  └─────────────────┘  └────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+
- npm or yarn
- macOS 13.2+ or Windows 10+
- AssemblyAI API key (for transcription)
- OpenAI API key (for callouts and summaries)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/weirdwiz/kakarot.git
cd kakarot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your API keys:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

4. Run in development mode:
```bash
npm run dev:electron
```

## Building for Production

```bash
# Build for current platform
npm run build

# Output will be in the 'release' folder
```

## Usage

1. **Start Recording**: Click the "Start Recording" button to begin capturing audio
2. **Configure API Keys**: Go to Settings and enter your AssemblyAI and OpenAI API keys
3. **Set Knowledge Base**: Point to a folder containing your reference documents
4. **During Meetings**:
   - Speak normally - your mic audio is labeled as "You"
   - Others' audio (from system) is labeled as "Other"
   - When a question is detected, a floating callout appears with context
5. **After Meetings**:
   - Generate AI summaries
   - Extract action items
   - Export to Markdown

## Project Structure

```
kakarot/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── index.ts             # Entry point
│   │   ├── core/                # Core infrastructure
│   │   │   ├── logger.ts        # Structured logging
│   │   │   └── container.ts     # Dependency injection
│   │   ├── handlers/            # IPC handlers by domain
│   │   │   ├── recordingHandlers.ts
│   │   │   ├── meetingHandlers.ts
│   │   │   ├── settingsHandlers.ts
│   │   │   └── calloutHandlers.ts
│   │   ├── data/                # Data access layer
│   │   │   ├── database.ts      # SQLite connection
│   │   │   └── repositories/    # Data repositories
│   │   ├── services/            # Business logic
│   │   │   ├── CalloutService.ts
│   │   │   ├── KnowledgeService.ts
│   │   │   └── ExportService.ts
│   │   ├── providers/           # External API clients
│   │   │   └── OpenAIProvider.ts
│   │   ├── prompts/             # LLM prompt templates
│   │   ├── config/              # Constants & configuration
│   │   └── windows/             # Window management
│   │
│   ├── renderer/                # React Frontend
│   │   ├── components/          # UI components
│   │   ├── lib/                 # Shared utilities
│   │   │   └── formatters.ts    # Formatting functions
│   │   ├── stores/              # Zustand state
│   │   └── hooks/               # Custom React hooks
│   │
│   ├── shared/                  # Cross-process shared code
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── ipcChannels.ts       # IPC channel constants
│   │   └── utils/               # Shared utilities
│   │       └── formatters.ts    # Common formatting
│   │
│   └── preload/                 # Secure IPC bridge
│
├── resources/                   # App icons
└── data/                        # Local data (gitignored)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 33+ |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Build | Vite + electron-builder |
| Audio | electron-audio-loopback |
| Transcription | AssemblyAI SDK |
| LLM | OpenAI SDK |
| Database | sql.js (SQLite in WASM) |
| State | Zustand |

## Configuration

Settings are stored locally and can be configured in the app:

| Setting | Description |
|---------|-------------|
| AssemblyAI API Key | Required for transcription |
| OpenAI API Key | Required for callouts and summaries |
| Knowledge Base Path | Folder with reference documents |
| Auto-detect Questions | Enable/disable question detection |
| Show Floating Callout | Enable/disable overlay popups |
| Transcription Language | Supported: en, es, fr, de, it, pt |

### Hosted tokens (zero-config onboarding)

Use hosted auth if your org issues short-lived OpenAI/AssemblyAI tokens from its own API:

1. In Settings → API Keys, enable "Use hosted tokens".
2. Enter the Auth API base URL and your JWT (provided by your admin).
3. The app will fetch and refresh scoped tokens automatically; leave the toggle off to use your own API keys instead.

## Platform Notes

### macOS
- Requires macOS 13.2+ for system audio loopback
- Grant microphone permission when prompted
- May need to grant screen recording permission for system audio

### Windows
- Works on Windows 10+
- Some systems may need to enable Stereo Mix

## Development

```bash
# Run in development mode
npm run dev:electron

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

MIT

## Acknowledgments

- [electron-audio-loopback](https://github.com/alectrocute/electron-audio-loopback) for system audio capture
- [AssemblyAI](https://www.assemblyai.com/) for real-time transcription
- [OpenAI](https://openai.com/) for LLM capabilities
