type SavedCredentials = {
  username: string
  password: string
}

type EncryptedPayload = {
  iv: string
  data: string
}

const STORAGE_KEY = "inventory.saved-credentials"
const CRYPTO_SALT = "inventory-control-credentials"
const CRYPTO_SECRET = "inventory-control"

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window
}

function toBase64(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(encoded: string) {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getKey() {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(CRYPTO_SECRET),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(CRYPTO_SALT),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

async function encryptPayload(payload: SavedCredentials) {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getKey()
  const encoded = encoder.encode(JSON.stringify(payload))
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  )
  return {
    iv: toBase64(iv),
    data: toBase64(encrypted),
  }
}

async function decryptPayload(payload: EncryptedPayload) {
  const decoder = new TextDecoder()
  const key = await getKey()
  const iv = fromBase64(payload.iv)
  const data = fromBase64(payload.data)
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
  return JSON.parse(decoder.decode(decrypted)) as SavedCredentials
}

export async function loadSavedCredentials() {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as EncryptedPayload
    return await decryptPayload(payload)
  } catch {
    return null
  }
}

export async function saveCredentials(credentials: SavedCredentials) {
  if (!canUseStorage()) return
  const payload = await encryptPayload(credentials)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearCredentials() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}
