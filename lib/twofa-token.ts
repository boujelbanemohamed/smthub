import { SignJWT, jwtVerify } from "jose"

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
}

export async function signPending(payload: PendingPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecretKey())
}

export async function verifyPending(token: string): Promise<PendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (payload.purpose !== "2fa") return null
    return { uid: payload.uid as number, method: payload.method as any, stage: payload.stage as any }
  } catch {
    return null
  }
}
