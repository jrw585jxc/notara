// AES-256-GCM encryption via Web Crypto API
// Key derived from PIN using PBKDF2 (200k iterations, SHA-256)

const VERIFY_PLAINTEXT = 'notara-v1-verify'
const ITERATIONS = 200_000

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

export function saltFromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  )
  // Cast to ArrayBuffer to satisfy strict TS typings on Uint8Array<ArrayBufferLike>
  const saltBuffer = salt.buffer instanceof ArrayBuffer
    ? salt.buffer
    : new Uint8Array(salt).buffer as ArrayBuffer
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

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

export async function createVerificationToken(key: CryptoKey): Promise<string> {
  return encryptText(VERIFY_PLAINTEXT, key)
}

export async function verifyPin(token: string, key: CryptoKey): Promise<boolean> {
  try {
    const result = await decryptText(token, key)
    return result === VERIFY_PLAINTEXT
  } catch {
    return false
  }
}
