# Installing Notara

## What you need first (one-time setup)

Install **Node.js** (the free runtime that builds the app):
- Go to **https://nodejs.org** and download the **LTS** version
- Run the installer, click Next through everything, done

---

## Windows

1. Open the `notara` folder
2. Double-click **`build-windows.bat`**
3. Wait ~2 minutes while it builds
4. A `release` folder opens — run **`Notara Setup.exe`** to install
5. Launch Notara from your Start Menu like any other app

> If Windows shows a SmartScreen warning, click **"More info"** → **"Run anyway"** (expected for unsigned personal apps)

---

## Mac

1. Open Terminal
2. `cd` into the `notara` folder
3. Run: `bash build-mac.sh`
4. Wait ~2 minutes while it builds
5. A `release` folder opens — drag **`Notara.dmg`** → Applications

> If Mac says the app can't be opened: right-click the app → **Open** → **Open** (needed once for unsigned personal apps)

---

## Running in dev mode (no build needed)

If you just want to run it quickly without building an installer:

```
npm install
npm run dev
```

This opens Notara in a live window. Changes to code reload automatically.

---

## Choosing your vault (first launch)

On first launch Notara asks you to choose a **vault folder** — this is where your notes are stored as `.md` files.

**Recommended:** Point it at a folder inside your **Proton Drive** sync folder so notes sync across your devices automatically.
