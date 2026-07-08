import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

/**
 * Stockage des jetons de réinitialisation / définition de mot de passe.
 * Implémentation fichier JSON (mode par défaut). En déploiement serverless
 * multi-instances, remplacer par une table dédiée (voir PRODUCTION.md).
 */
const RESET_FILE = path.join(process.cwd(), "data", "password-resets.json")

export interface ResetEntry {
  token: string
  userId: number
  email: string
  expiresAt: number
  used: boolean
}

async function readEntries(): Promise<ResetEntry[]> {
  try {
    return JSON.parse(await fs.readFile(RESET_FILE, "utf-8"))
  } catch {
    return []
  }
}

async function writeEntries(entries: ResetEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(RESET_FILE), { recursive: true })
  await fs.writeFile(RESET_FILE, JSON.stringify(entries, null, 2))
}

/** Crée un jeton à usage unique et purge les jetons expirés/utilisés. */
export async function createResetToken(userId: number, email: string, ttlMinutes = 60): Promise<string> {
  const now = Date.now()
  // On conserve uniquement les jetons encore valides des AUTRES utilisateurs/emails.
  const entries = (await readEntries()).filter(
    (e) => e.expiresAt > now && !e.used && e.email !== email
  )
  const token = crypto.randomBytes(32).toString("hex")
  entries.push({ token, userId, email, expiresAt: now + ttlMinutes * 60 * 1000, used: false })
  await writeEntries(entries)
  return token
}

/** Retourne l'entrée si le jeton est valide (sans le consommer). */
export async function peekResetToken(token: string): Promise<ResetEntry | null> {
  if (!token) return null
  const entry = (await readEntries()).find((e) => e.token === token)
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null
  return entry
}

/** Valide ET consomme le jeton (usage unique). */
export async function consumeResetToken(token: string): Promise<ResetEntry | null> {
  if (!token) return null
  const entries = await readEntries()
  const entry = entries.find((e) => e.token === token)
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null
  entry.used = true
  await writeEntries(entries)
  return entry
}
