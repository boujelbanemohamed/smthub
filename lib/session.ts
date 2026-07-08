import { SignJWT, jwtVerify } from "jose"

export interface SessionPayload {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
}

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7 // 7 jours

// Repli de développement uniquement : permet de lancer `npm run dev` sans
// configuration. JAMAIS utilisé en production (voir le throw ci-dessous).
const DEV_FALLBACK_SECRET =
  "dev-only-insecure-secret-change-me-0000000000000000000000000000"
let devWarningShown = false

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET n'est pas défini. Définissez une valeur aléatoire forte dans les variables d'environnement (ex: openssl rand -base64 48)."
      )
    }
    if (!devWarningShown) {
      console.warn(
        "[session] SESSION_SECRET non défini : utilisation d'un secret de développement non sécurisé. " +
          "Définissez SESSION_SECRET avant tout déploiement."
      )
      devWarningShown = true
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET)
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    const { id, nom, email, role } = payload as Record<string, unknown>
    if (typeof id !== "number" || typeof nom !== "string" || typeof email !== "string") {
      return null
    }
    if (role !== "admin" && role !== "utilisateur") {
      return null
    }
    return { id, nom, email, role }
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = "user-session"
export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS
