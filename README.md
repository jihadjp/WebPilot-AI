# WebPilot AI — Understand the web. Take smarter action.

Production-minded, source-grounded AI browser extension (Manifest V3 for Google Chrome & Microsoft Edge) and full-stack TypeScript backend.

## Core Capabilities

1. **Current Page Assistant (Side Panel)**:
   - Displays current webpage title, hostname, and URL eligibility status.
   - Requires explicit **"Use this page"** consent before extracting readable article sections (`S1`, `S2`, ...).
   - Handles browser-internal (`chrome://`, `edge://`) and extension-store pages gracefully.
2. **Source-Grounded AI Summaries**:
   - Formats: Short summary, Detailed summary, Key takeaways, Step-by-step explanation, Bengali summary (`বাংলা`), and English summary.
   - Displays main ideas, important terms, and verified source reference citations mapped strictly to extracted page blocks.
3. **Contextual Q&A**:
   - Multi-turn session conversation grounded in captured page blocks.
   - Distinguishes sourced evidence (`evidenceSufficient: true`) from unsupported queries without fabricating citations.
4. **Explain Selected Text**:
   - Operations: Explain simply, Translate into Bengali, Translate into English, Give an example, Explain code, Create short notes.
   - Treats webpage selections as untrusted data with prompt-injection sanitization.
5. **Study Mode**:
   - Generates schema-validated 5-question multiple-choice quizzes, interactive grading with explanations, flashcards, and revision notes.
6. **Saved Library & Workspaces**:
   - Authenticated per-user persistence with search by title/hostname, workspace filtering, personal note editing, and deletion.
7. **Bilingual & Theme Support**:
   - Full English (`en`) and Bengali (`bn` / `বাংলা`) localization dictionary (`src/shared/i18n.ts`).
   - Dark, Light, and System themes with persistent preferences.

## Quick Start & Commands

```bash
# 1. Install dependencies
npm install

# 2. Optional: Start local PostgreSQL via Docker Compose
docker compose up -d

# 3. Run development server (Frontend + Backend API on http://localhost:3000)
npm run dev

# 4. Run unit & integration test suite
npm test

# 5. Typecheck & build production bundle
npm run lint
npm run build

# 6. Package unpacked Manifest V3 extension into dist-extension/
npm run package:extension
```

## Loading the Unpacked Extension in Chrome & Edge

1. Run `npm run build && npm run package:extension` to generate the `dist-extension/` directory containing `manifest.json`, `background.js`, `content.js`, and the compiled Side Panel UI.
2. **Google Chrome**:
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top-right toggle)
   - Click **Load unpacked** and select the `dist-extension/` folder.
3. **Microsoft Edge**:
   - Open `edge://extensions/`
   - Enable **Developer mode** (left sidebar toggle)
   - Click **Load unpacked** and select the `dist-extension/` folder.
