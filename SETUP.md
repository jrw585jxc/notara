# Notara — Setup Guide

## Prerequisites

Install [Node.js](https://nodejs.org/) (version 18 or newer) on your machine.

---

## First-time setup

Open a terminal in the `notara` folder and run:

```bash
npm install
```

This installs all dependencies (~2 minutes).

---

## Running the app (development)

```bash
npm run dev
```

This starts both the Vite dev server and Electron together. The app window opens automatically.

---

## Building for Windows (.exe installer)

```bash
npm run electron:build:win
```

Output is in the `release/` folder.

## Building for Mac (.dmg)

```bash
npm run electron:build:mac
```

Output is in the `release/` folder.

---

## Syncing with Proton Drive

1. Install the [Proton Drive desktop app](https://proton.me/drive/download)
2. When Notara asks you to choose a vault folder, navigate into your Proton Drive folder and create a subfolder called `Notara` (or anything you like)
3. Select that folder
4. All your notes are now stored there as `.md` files and synced automatically

On Android, install the Proton Drive app and your notes will appear there too. (Android native app coming next.)

---

## Android APK (coming next session)

The Android app uses Capacitor to wrap the same codebase. Steps:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/filesystem
npx cap init Notara com.notara.app
npx cap add android
npm run build
npx cap sync android
npx cap open android   # Opens Android Studio — build APK from there
```

---

## Keyboard shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Search | Ctrl+K | Cmd+K |
| New page | Ctrl+N | Cmd+N |
| Toggle sidebar | Ctrl+\\ | Cmd+\\ |
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Slash commands | / | / |

---

## File format

Each page is a `.md` file with YAML frontmatter:

```markdown
---
id: "abc123"
title: "My Page"
emoji: "📄"
parentId: null
tags: ["work", "ideas"]
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T12:00:00Z"
order: 0
---

<h1>My Page</h1>
<p>Content here…</p>
```

Files are human-readable and portable — you can open them in any text editor .
