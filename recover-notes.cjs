/**
 * Notara — Old PIN Encryption Recovery Script
 *
 * Decrypts .md files that were encrypted with the OLD pin-only scheme
 * (PBKDF2(pin, pinSalt, 100k) → AES-256-GCM) and writes them back as
 * plain Markdown so Notara can open them again.
 *
 * Usage:
 *   node recover-notes.cjs <your-old-pin>
 *
 * The script reads your vault path and old salt automatically from
 * notara-prefs.json in your Electron userData folder.
 *
 * Files that cannot be decrypted (wrong PIN, or already plaintext)
 * are left untouched — you cannot break anything by running this.
 */

'use strict'
const crypto = require('node:crypto')
const fs     = require('node:fs')
const path   = require('node:path')
const os     = require('node:os')

// ── 1. Parse args ─────────────────────────────────────────────
const pin = process.argv[2]
if (!pin) {
  console.error('Usage: node recover-notes.cjs <your-old-pin>')
  process.exit(1)
}

// ── 2. Find prefs file ────────────────────────────────────────
// Electron stores userData in AppData/Roaming/<appName> on Windows.
// Try common locations in order.
const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
const prefsCandidates = [
  path.join(appDataDir, 'Notara',  'notara-prefs.json'),
  path.join(appDataDir, 'notara',  'notara-prefs.json'),
  path.join(appDataDir, 'notara-app', 'notara-prefs.json'),
]

let prefsPath = null
for (const p of prefsCandidates) {
  if (fs.existsSync(p)) { prefsPath = p; break }
}

if (!prefsPath) {
  console.error('Could not find notara-prefs.json. Tried:')
  prefsCandidates.forEach(p => console.error('  ' + p))
  console.error('\nRun Notara once to create the prefs file, or set NOTARA_PREFS env var to its full path.')
  process.exit(1)
}

console.log('Reading prefs from:', prefsPath)
let prefs
try { prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8')) }
catch (e) { console.error('Failed to parse prefs:', e.message); process.exit(1) }

// ── 3. Get old PIN salt ───────────────────────────────────────
// Old scheme stored salt as pinSalt; new scheme as salt.
// We want the one that was used with the PIN directly (not master password).
const saltB64 = prefs.pinSalt || prefs.salt
if (!saltB64) {
  console.error('No PIN salt found in prefs (looked for "pinSalt" and "salt").')
  console.error('If your prefs were cleared, recovery is not possible without the original salt.')
  process.exit(1)
}
console.log('Found salt:', saltB64.slice(0, 8) + '…')

// ── 4. Get vault path ─────────────────────────────────────────
const vaultPath = process.env.NOTARA_VAULT || prefs.vault
if (!vaultPath || !fs.existsSync(vaultPath)) {
  console.error('Vault folder not found:', vaultPath)
  console.error('Set NOTARA_VAULT env var to your vault folder path if it has moved.')
  process.exit(1)
}
console.log('Vault:', vaultPath)

// ── 5. Derive key (same PBKDF2 params the old crypto.ts used) ─
async function deriveKey(pin, saltB64) {
  const salt = Buffer.from(saltB64, 'base64')
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(pin, salt, 100_000, 32, 'sha256', (err, key) => {
      if (err) reject(err); else resolve(key)
    })
  })
}

// ── 6. Decrypt one ciphertext blob ───────────────────────────
// Format written by Web Crypto encryptText():
//   base64( 12-byte-IV || AES-GCM-ciphertext+16-byte-authTag )
function tryDecrypt(ciphertextB64, keyBuf) {
  try {
    const combined = Buffer.from(ciphertextB64.trim(), 'base64')
    if (combined.length < 29) return null   // too short to be valid (12 IV + 1 data + 16 tag)
    const iv         = combined.subarray(0, 12)
    const withTag    = combined.subarray(12)
    const tag        = withTag.subarray(withTag.length - 16)
    const ciphertext = withTag.subarray(0, withTag.length - 16)
    const decipher   = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plain.toString('utf-8')
  } catch {
    return null
  }
}

// ── 7. Main ───────────────────────────────────────────────────
;(async () => {
  console.log('\nDeriving key from PIN (this takes a moment)…')
  const keyBuf = await deriveKey(pin, saltB64)
  console.log('Key derived.\n')

  const files = fs.readdirSync(vaultPath).filter(f => f.endsWith('.md'))
  if (files.length === 0) {
    console.log('No .md files found in vault.')
    return
  }

  let decrypted = 0, skipped = 0, alreadyPlain = 0

  for (const filename of files) {
    const filepath = path.join(vaultPath, filename)
    const raw = fs.readFileSync(filepath, 'utf-8').trim()

    // Quick check: if it starts with --- or a heading it's already plaintext
    if (raw.startsWith('---') || raw.startsWith('#') || raw.startsWith('<!--')) {
      console.log('  [plain]     ' + filename)
      alreadyPlain++
      continue
    }

    // Try to decrypt
    const plain = tryDecrypt(raw, keyBuf)
    if (plain === null) {
      console.log('  [skipped]   ' + filename + ' (wrong PIN or already plain)')
      skipped++
      continue
    }

    // Sanity check: decrypted content should look like markdown
    if (!plain.startsWith('---') && !plain.startsWith('#') && !plain.startsWith('<!--') && plain.length < 5) {
      console.log('  [skipped]   ' + filename + ' (decrypted but looks wrong)')
      skipped++
      continue
    }

    fs.writeFileSync(filepath, plain, 'utf-8')
    console.log('  [decrypted] ' + filename)
    decrypted++
  }

  console.log(`\nDone. ${decrypted} decrypted, ${alreadyPlain} already plain, ${skipped} skipped.`)
  if (decrypted > 0) {
    console.log('\nYour notes are now plain Markdown. Open Notara — they should load normally.')
    console.log('If you want encryption again, use "Enable Encryption" in the ··· menu.')
  }
  if (skipped > 0 && decrypted === 0) {
    console.log('\nNo files were decrypted. Double-check your PIN is correct.')
  }
})()
