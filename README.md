<div align="center">
  <img src="public/notara-mark-mono.svg" width="72" height="72" alt="Notara" />
  <h1>Notara</h1>
  <p><strong>Private, offline-first note-taking — fast, encrypted, yours.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)](https://github.com/jrw585jxc/notara/releases/latest)
  [![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F)](https://www.electronjs.org/)

  <br />

  [**Download for Windows (.exe)**](https://github.com/jrw585jxc/notara/releases/download/v1.0.0/Notara-Setup.exe) &nbsp;·&nbsp; [**Download for macOS (.dmg)**](https://github.com/jrw585jxc/notara/releases/download/v1.0.0/Notara-mac-1.0.0.zip) &nbsp;·&nbsp; [View all releases](https://github.com/jrw585jxc/notara/releases)

</div>

---

Notara is a desktop note-taking app built for people who want to think without friction. Notes are stored as plain Markdown files on your own computer — no account, no cloud, no subscription. Sync happens through whatever folder-syncing tool you already use.

It's fast to open, fast to write in, and everything stays private by default.

---

## Features

### Block editor

Notara uses a full rich-text editor (powered by [TipTap](https://tiptap.dev/) / ProseMirror) that keeps the writing experience clean while giving you real formatting power.

| Feature | Details |
|---|---|
| Headings | H1–H3 via `/` slash commands or keyboard shortcuts |
| Rich text | **Bold**, *italic*, ~~strikethrough~~, `inline code`, underline |
| Lists | Bulleted, numbered, and nested task lists (checkboxes) |
| Tables | Insert and resize tables inline |
| Code blocks | Fenced code with syntax highlighting |
| Blockquotes | Pull quotes and callout-style blocks |
| Typographic polish | Smart quotes, em-dashes, ellipsis replacement |
| Links | Paste a URL over selected text to create a hyperlink |

### Page organisation

Notes are grouped into **Notebooks** (top-level folders) and organised with **Tags**. The sidebar shows your full note tree, and you can drag pages between notebooks, pin favourites, and archive notes you want out of the way without deleting them.

- Drag-and-drop reordering (powered by `@dnd-kit`)
- Emoji icons on pages and notebooks
- Pin important notes to the top of the list
- Archive to keep the sidebar clean without losing anything
- Cover images per page

### Sticky notes

Detach any page into a **sticky note** — a small, always-on-top floating window that stays visible while you work in other apps. Sticky notes are the same page as in the sidebar; changes sync instantly in both directions.

- Multiple sticky notes can be open at the same time
- Each sticky note remembers its position and size
- Always-on-top can be toggled per window
- Accessible from the system tray even when the main window is closed

### Search

Full-text search across all your notes with instant results as you type. Search indexes note titles and body content. Results show a contextual excerpt so you can see the match before opening the note.

### Export and import

Export any note as a **Markdown file** or a clean **PDF** (via the OS print dialog). Import existing Markdown files from any other app — Notara reads standard CommonMark with YAML frontmatter.

### Themes and typography

Notara ships with a carefully tuned light and dark theme. The theme follows your system preference automatically, or you can pin it in Settings.

- System / Light / Dark mode
- Calm, typographically refined aesthetic — content-first
- Consistent spacing and hierarchy throughout the editor

### System tray

Notara keeps a tray icon running so it's always a click away. From the tray you can open the main window, create a new sticky note directly, or quit the app.

### Encryption (optional)

Notara can encrypt your vault with a master password. If enabled, every note file is encrypted with **AES-256-GCM** before being written to disk — so even if someone has access to your sync folder or your files, they can't read anything without your password.

See [Encryption](#encryption) below for the full technical details.

### PIN lock

Set a 4–8 digit PIN as a quick unlock shortcut. The PIN is backed by your master password — losing the PIN doesn't lock you out. The PIN wraps the master key so your vault decryption key is never stored anywhere without protection.

---

## How syncing works

Notara stores everything in a **vault** — a regular folder you choose on your computer. Every note is a `.md` file inside that folder. There's no proprietary database or binary format.

```
My Vault/
├── _notara-meta.json          ← notebook/tag metadata
├── _notara-enc.json           ← encryption config (if enabled)
├── getting-started.md
├── work/
│   ├── project-alpha.md
│   └── meeting-notes.md
└── personal/
    ├── reading-list.md
    └── journal/
        └── 2025-01.md
```

Because it's just a folder of files, **any sync service that can sync a folder will work**:

| Service | Notes |
|---|---|
| [iCloud Drive](https://www.apple.com/icloud/) | Works natively on macOS; install the Windows client for cross-platform |
| [Dropbox](https://www.dropbox.com/) | Reliable and fast; good conflict detection |
| [OneDrive](https://www.microsoft.com/onedrive) | Built into Windows; works on macOS too |
| [Syncthing](https://syncthing.net/) | Fully open source, peer-to-peer, no cloud middleman |
| [Resilio Sync](https://www.resilio.com/sync/) | Fast peer-to-peer syncing |
| [Google Drive](https://www.google.com/drive/) | Works; use the desktop client (Drive for Desktop) |
| [Proton Drive](https://proton.me/drive) | End-to-end encrypted cloud storage |

**Conflict handling:** If two devices edit the same note while offline, your sync service will detect the conflict and create a duplicate file. Notara will show both versions in the sidebar. You can read both and manually merge them — you stay in control.

**Encryption and sync:** If you enable encryption, the `.md` files on disk contain encrypted ciphertext. The encryption happens locally before anything is written. Your sync service only ever sees the encrypted bytes.

**Switching devices:** Open Notara on the new device and point it at the same synced folder. That's it.

---

## Note file format

Every note is a standard Markdown file with YAML frontmatter. You can open, edit, and version-control them with any text editor.

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
title: Project Alpha
created: 2025-01-15T09:30:00.000Z
updated: 2025-06-02T14:22:11.000Z
notebook: work
tags:
  - projects
  - active
icon: 🚀
pinned: false
archived: false
---

# Project Alpha

Your note content here...
```

| Field | Type | Description |
|---|---|---|
| `id` | UUID string | Stable unique identifier for the note |
| `title` | string | Display name |
| `created` | ISO 8601 | Creation timestamp |
| `updated` | ISO 8601 | Last-modified timestamp |
| `notebook` | string | Parent notebook slug |
| `tags` | string array | Tag names |
| `icon` | string | Emoji or empty |
| `pinned` | boolean | Pinned to top of list |
| `archived` | boolean | Archived (hidden from main view) |

---

## Encryption

Encryption is optional. If you don't set a password, notes are stored as plain Markdown.

### Architecture

```
Password (user input)
        │
        ▼
  PBKDF2-SHA-256
  200,000 iterations
  random 16-byte salt
        │
        ▼
  Master Key (AES-256)
        │
        ├──▶  encrypt / decrypt note files
        │         AES-256-GCM
        │         random IV per file
        │
        └──▶  wrapped by PIN key (if PIN is set)
                  │
                  ▼
            PIN Key (AES-256)
            PBKDF2-SHA-256
            100,000 iterations
            stored wrapped master key
```

### What's stored on disk

`_notara-enc.json` in the vault contains the PBKDF2 salt, a verification token (used to confirm the password is correct without decrypting a full note), and the PIN-wrapped master key (if a PIN is set). The master key itself is **never written to disk unencrypted**. Each note file is encrypted independently with a random IV prepended to the ciphertext.

### PIN unlock

The PIN is a convenience shortcut. Internally it derives its own AES-256 key via PBKDF2 and uses it to wrap (encrypt) the master key. When you enter your PIN, Notara unwraps the master key without requiring your full password. The full master password can always be used to unlock regardless of PIN state.

### Cryptographic parameters

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key derivation | PBKDF2-SHA-256 |
| Master key iterations | 200,000 |
| PIN key iterations | 100,000 |
| Salt length | 16 bytes (random per vault) |
| IV length | 12 bytes (random per file) |
| Implementation | Web Crypto API (browser-native, no third-party crypto library) |

---

## Installation

### Windows

1. Download **Notara-Setup.exe** from the [latest release](https://github.com/jrw585jxc/notara/releases/latest).
2. Run the installer. Notara uses [Squirrel](https://github.com/Squirrel/Squirrel.Windows) so there's no "Next → Next → Install" wizard — it installs silently and opens immediately.
3. Notara appears in your Start menu and system tray.

> **Windows SmartScreen:** Because Notara is an open-source app without an EV code-signing certificate, Windows may show a SmartScreen warning. Click **More info → Run anyway** to proceed. The source code is fully open and auditable here on GitHub.

### macOS

1. Download **Notara-mac-1.0.0.zip** from the [latest release](https://github.com/jrw585jxc/notara/releases/latest).
2. Unzip and drag **Notara.app** into your Applications folder.
3. On first launch, right-click the app and choose **Open** to bypass the Gatekeeper warning for unsigned apps.

> **Gatekeeper:** Apple requires a paid Developer Program membership to notarise apps for distribution. Notara is free and open source, so it ships unsigned. The right-click → Open method bypasses this one time; after that it opens normally.

---

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm 10+
- Git

### Run in development

```bash
git clone https://github.com/jrw585jxc/notara.git
cd notara
npm install
npm run dev
```

This starts Vite (renderer) and Electron concurrently. The app opens automatically.

### Build a distributable

**Windows** (run on Windows):
```bash
npm run make:win
```

**macOS**:
```bash
npm run make:mac
```

Output goes to `out/make/`. The Windows build produces `Notara-Setup.exe` (Squirrel installer) and a `.zip`. The macOS build produces a universal `.zip` for both Apple Silicon and Intel.

### Project structure

```
notara/
├── electron/
│   ├── main.cjs          ← Electron main process (window management, tray, IPC)
│   └── preload.cjs       ← Contextbridge / IPC surface exposed to renderer
├── src/
│   ├── components/       ← React UI components
│   │   ├── editor/       ← TipTap editor and toolbar
│   │   ├── Layout.tsx    ← Shell: sidebar + content area
│   │   ├── StickyNoteView.tsx ← Sticky note window renderer
│   │   ├── VaultSetup.tsx     ← First-run vault selection
│   │   └── PinScreen.tsx      ← PIN unlock screen
│   ├── store/
│   │   └── useStore.ts   ← Zustand store — all state and business logic
│   ├── lib/
│   │   ├── crypto.ts     ← AES-256-GCM / PBKDF2 helpers (Web Crypto API)
│   │   └── markdown.ts   ← Frontmatter parsing and serialisation
│   ├── App.tsx
│   └── index.css
├── public/               ← Static assets
├── build-resources/      ← App icons (icon.ico, icon.png, icon.icns)
└── package.json
```

### Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 42 |
| Renderer | React 19 + TypeScript |
| Build | Vite 8 |
| Editor | TipTap 3 (ProseMirror) |
| State | Zustand 5 |
| Drag and drop | @dnd-kit |
| Cryptography | Web Crypto API (AES-256-GCM, PBKDF2) |
| Packaging | Electron Forge + Squirrel (Windows), ZIP (macOS) |
| Styling | Tailwind CSS 4 |

---

## Contributing

Contributions are welcome. Notara is a small, focused app — the goal is to keep it that way.

1. Fork the repo and create a feature branch.
2. Run `npm run dev` to start the development environment.
3. Make your changes. Keep the scope tight — PRs that do one thing are much easier to review.
4. Run `npm run lint` before pushing.
5. Open a pull request with a clear description of what changed and why.

If you're planning something large, open an issue first to discuss it. The priority is keeping the app fast, minimal, and reliable — not adding features for their own sake.

**Reporting bugs:** Open a GitHub issue. Include your OS version, what you did, what you expected, and what actually happened. Screenshots help a lot.

---

## License

MIT © Notara contributors

You're free to use, modify, and distribute this software. See [LICENSE](LICENSE.md) for the full text.

---

<div align="center">
  <sub>Built with care. Stores nothing in the cloud. Reads nothing you don't write.</sub>
</div>
