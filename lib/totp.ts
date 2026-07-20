import crypto from "crypto"

// Implémentation TOTP (RFC 6238) sans dépendance externe : HMAC-SHA1, 6
// chiffres, période de 30 s, tolérance ±1 fenêtre. Compatible Google
// Authenticator, Microsoft Authenticator, Authy, 1Password, etc.

const DIGITS = 6
const PERIOD = 30
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

// Génère un secret aléatoire encodé en base32 (par défaut 20 octets = 160 bits).
export function generateSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes)
  return base32Encode(buf)
}

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ""
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return out
}

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").toUpperCase().replace(/\s/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// Calcule le code TOTP pour un compteur donné.
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  // Écrit le compteur en big-endian 64 bits.
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff
    counter = Math.floor(counter / 256)
  }
  const hmac = crypto.createHmac("sha1", key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0")
}

// Vérifie un code saisi contre le secret, avec tolérance ±window fenêtres
// (pour absorber un léger décalage d'horloge).
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  if (!secret || !token) return false
  const clean = token.replace(/\s/g, "")
  if (!/^\d{6}$/.test(clean)) return false
  const counter = Math.floor(Date.now() / 1000 / PERIOD)
  for (let w = -window; w <= window; w++) {
    if (timingSafeEqual(hotp(secret, counter + w), clean)) return true
  }
  return false
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  try {
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

// URL otpauth:// à encoder dans le QR code (label + émetteur).
export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
