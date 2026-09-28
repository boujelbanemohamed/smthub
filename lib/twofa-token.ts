import { SignJWT, jwtVerify } from "jose"
import crypto from "crypto"

// Jeton court (5 min) émis après vérification du mot de passe, tant que le
// second facteur n'a pas été validé. Il ne donne AUCUN accès : il sert
// uniquement à relier la saisie du code 2FA à l'utilisateur authentifié par
// mot de passe. La vraie session n'est créée qu'après validation du code.

const DEV_FALLBACK_SECRET =
  "dev-only-insecure-secret-change-me-0000000000000000000000000000"

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || DEV_FALLBACK_SECRET
  return new TextEncoder().encode(secret)
}

export interface PendingPayload {
  uid: number
  method: "totp" | "email"
  stage: "totp" | "enroll_totp" | "email"
  jti: string
}

// Anti-rejeu : jetons déjà « consommés » (une vérification réussie) gardés en
// mémoire jusqu'à leur expiration. Empêche de rejouer le même jeton pour
// ouvrir plusieurs sessions durant sa fenêtre de validité (5 min).
const consumed = new Map<string, number>() // jti → timestamp d'expiration (ms)
function purge() {
  const now = Date.now()
  for (const [jti, exp] of consumed) if (exp < now) consumed.delete(jti)
}

export async function signPending(payload: Omit<PendingPayload, "jti">): Promise<string> {
  const jti = crypto.randomBytes(16).toString("hex")
  return new SignJWT({ ...payload, jti, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecretKey())
}

export async function verifyPending(token: string): Promise<PendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (payload.purpose !== "2fa") return null
    const jti = payload.jti as string
    purge()
    // Jeton déjà consommé → refus (anti-rejeu).
    if (jti && consumed.has(jti)) return null
    return { uid: payload.uid as number, method: payload.method as any, stage: payload.stage as any, jti }
  } catch {
    return null
  }
}

// Marque le jeton comme consommé après une vérification 2FA réussie. À n'appeler
// QUE depuis l'endpoint de vérification (pas depuis l'enrôlement, qui peut être
// rejoué tant que le code n'a pas été validé).
export function consumePending(jti: string): void {
  if (!jti) return
  purge()
  // Conserve le jti bloqué jusqu'à la fin de la fenêtre de validité du jeton.
  consumed.set(jti, Date.now() + 6 * 60 * 1000)
}
