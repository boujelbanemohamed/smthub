import crypto from "crypto"

/**
 * Chiffrement réversible (AES-256-GCM) pour les secrets qui doivent être
 * réaffichés (ex. identifiants d'applications tierces enregistrés par un
 * utilisateur). À NE PAS confondre avec bcrypt (mots de passe de connexion,
 * à sens unique).
 *
 * La clé provient de la variable d'environnement CREDENTIALS_SECRET.
 */
const ALGO = "aes-256-gcm"
const DEV_FALLBACK_SECRET = "dev-only-insecure-credentials-secret-change-me"
let devWarningShown = false

function getKey(): Buffer {
  let secret = process.env.CREDENTIALS_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CREDENTIALS_SECRET n'est pas défini. Définissez une valeur aléatoire forte (ex: openssl rand -base64 48)."
      )
    }
    if (!devWarningShown) {
      console.warn(
        "[crypto-vault] CREDENTIALS_SECRET non défini : clé de développement non sécurisée utilisée. " +
          "Définissez CREDENTIALS_SECRET avant tout déploiement."
      )
      devWarningShown = true
    }
    secret = DEV_FALLBACK_SECRET
  }
  // Dérive une clé de 32 octets à partir du secret.
  return crypto.createHash("sha256").update(secret).digest()
}

/** Chiffre une chaîne. Renvoie `ivB64:tagB64:cipherB64`. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

/** Déchiffre une valeur produite par encryptSecret. Renvoie "" si invalide. */
export function decryptSecret(payload: string): string {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":")
    if (!ivB64 || !tagB64 || !dataB64) return ""
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ])
    return decrypted.toString("utf8")
  } catch {
    return ""
  }
}
