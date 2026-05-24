// AES-256-GCM encryption via Web Crypto API
// Master key: PBKDF2 from master password + vault salt (stored in vault/_notara-enc.json)
// PIN key:    PBKDF2 from PIN + pin-salt (stored in device prefs) — wraps master key locally

const VERIFY_PLAINTEXT = 'notara-v1-verify'
const MASTER_ITERATIONS = 200_000
const PIN_ITERATIONS = 100_000

// ── Byte / Base64 helpers ─────────────────────────────────────
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

export function saltFromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function toSaltBuffer(salt: Uint8Array): ArrayBuffer {
  return salt.buffer instanceof ArrayBuffer
    ? salt.buffer
    : new Uint8Array(salt).buffer as ArrayBuffer
}

// ── Master key (PBKDF2 from master password + vault salt) ─────
// Extractable so it can be wrapped by the PIN key.
export async function deriveMasterKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toSaltBuffer(salt), iterations: MASTER_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,                          // extractable — needed for PIN wrapping
    ['encrypt', 'decrypt']
  )
}

// ── PIN key (PBKDF2 from PIN + device salt) ───────────────────
// Not extractable; used only to wrap/unwrap the master key.
export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toSaltBuffer(salt), iterations: PIN_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Legacy alias — kept so old call-sites compile without change.
export const deriveKey = derivePinKey

// ── Key serialization helpers ─────────────────────────────────
async function exportKeyRaw(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

async function importKeyRaw(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'AES-GCM', length: 256 },
    true,                          // extractable — needed to share with sticky note windows
    ['encrypt', 'decrypt']
  )
}

// ── Master key wrapping (for PIN-based device shortcut) ───────
// Encrypts the raw master key bytes using the PIN-derived key.
export async function wrapMasterKey(masterKey: CryptoKey, pinKey: CryptoKey): Promise<string> {
  const exported = await exportKeyRaw(masterKey)
  return encryptText(exported, pinKey)
}

// Decrypts the wrapped master key bytes and re-imports as CryptoKey.
export async function unwrapMasterKey(wrapped: string, pinKey: CryptoKey): Promise<CryptoKey> {
  const exported = await decryptText(wrapped, pinKey)
  return importKeyRaw(exported)
}

// ── Symmetric encrypt / decrypt ───────────────────────────────
export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoder.encode(plaintext)
  )
  const combined = new Uint8Array(12 + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), 12)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptText(ciphertext: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

// ── Verification token ────────────────────────────────────────
export async function createVerificationToken(key: CryptoKey): Promise<string> {
  return encryptText(VERIFY_PLAINTEXT, key)
}

export async function verifyKey(token: string, key: CryptoKey): Promise<boolean> {
  try {
    const result = await decryptText(token, key)
    return result === VERIFY_PLAINTEXT
  } catch {
    return false
  }
}

// Legacy alias
export const verifyPin = verifyKey
