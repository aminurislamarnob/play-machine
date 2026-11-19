# Playmachine — Local Course Player & Personal LMS for macOS

A native-feeling **Electron macOS desktop application** for watching local video course collections with automatic lesson title generation, LMS progress tracking, timestamped Markdown notes, bookmarks, active-recall flashcards, and a Faddy-inspired editorial UI.

## Key Features

- **Smart Folder & Collection Import**:
  - Pick a single course folder (flat videos or nested module subfolders) **or** a root collection folder containing multiple courses — or drag & drop folders directly onto the app.
  - Live **Import Preview** lets you inspect raw filenames alongside auto-generated lesson titles, toggle between *1 Course with Modules* and *Course Collection*, edit titles, add tags, and choose course accent colors.
- **Automatic Lesson Title Generator**:
  - Strips extensions, resolution/codec/ripper tags (`[1080p]`, `(720p_WEB-DL)`, `[TutFlix]`, trailing video IDs), extracts leading numbers/prefixes (`01_`, `Lesson 04 -`, `S01E05_`, `[07]`), naturally sorts `1, 2, …, 10`, and applies smart Title Case preserving technical terms (`React`, `Next.js`, `Node.js`, `TypeScript`, `REST`, `API`, `GraphQL`, `macOS`, `SwiftUI`, `CI/CD`, `useEffect`).
  - Inline rename any lesson, module, or course anytime, with one-click reset to generated title.
- **Custom Local Video Player**:
  - Byte-range local media streaming via a custom `course-media://` protocol for instant seeking on large `.mp4`, `.mov`, `.m4v`, `.webm`, and `.mkv` files.
  - Native `.srt` (auto-converted to WebVTT) and `.vtt` subtitle discovery & rendering.
  - Playback speed (`0.5x–2.5x`), A-B segment looping, Picture-in-Picture, Fullscreen, Focus/Theater mode, auto-resume per lesson, auto-complete threshold, auto-play next countdown, and full keyboard shortcuts.
- **Full Personal LMS Suite**:
  - **Timestamped Notes** (`N`) with tags (`Concept`, `Code`, `Key Insight`, `Follow-up`), clickable scrub-bar markers, and one-click **Markdown (`.md`) export**.
  - **Bookmarks** (`B`) rendered as clickable diamonds on the timeline.
  - **Companion Resources**: Automatically surfaces `.pdf`, `.md`, `.txt`, `.zip`, `.ipynb`, and slide decks in course folders.
  - **Review Cards (Flashcards)**: Create active-recall Q&A cards per lesson and track mastery.
  - **Study Activity & Streaks**: 20-week study heatmap, daily study goal meter, current/longest streak tracking, and course completion matrix.
  - **Command Palette (`⌘K`)** & **Ivory Canvas / Oceanic Ink** dual Faddy themes.

## Commands

```bash
# Install dependencies
npm install

# Run in development mode (Vite + Electron)
npm run dev

# Run unit tests (title generator, folder scanner, SRT-to-VTT)
npm test

# Type-check & production build
npm run typecheck
npm run build

# Launch built desktop app
npm start

# Package macOS .dmg / .zip
npm run dist:mac
```
