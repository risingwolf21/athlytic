/** AES-256-GCM encryption for provider credentials. The key lives only in the function environment. */

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))

async function importKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('CREDENTIAL_ENCRYPTION_KEY')
  if (!raw) throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured')
  const bytes = fromBase64(raw)
  if (bytes.length !== 32) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes, base64 encoded')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(), new TextEncoder().encode(plaintext))
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) }
}

export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await importKey(), fromBase64(ciphertext))
  return new TextDecoder().decode(decrypted)
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
