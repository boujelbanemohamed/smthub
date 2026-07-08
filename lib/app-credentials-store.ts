import { promises as fs } from "fs"
import path from "path"
import { encryptSecret, decryptSecret } from "@/lib/crypto-vault"

/**
 * Coffre-fort personnel : identifiants d'applications tierces enregistrés par
 * chaque utilisateur. Le mot de passe et la note sont chiffrés au repos
 * (AES-256-GCM). Le login est conservé en clair (identifiant, non secret).
 *
 * Stockage fichier JSON (mode par défaut). En serverless/Postgres, prévoir une
 * table dédiée (voir PRODUCTION.md).
 */
const CREDS_FILE = path.join(process.cwd(), "data", "app-credentials.json")

interface StoredEntry {
  utilisateur_id: number
  application_id: number
  login: string
  password_enc: string
  note_enc: string
  updatedAt: string
}

export interface PlainCredential {
  application_id: number
  login: string
  password: string
  note: string
  updatedAt: string
}

async function readAll(): Promise<StoredEntry[]> {
  try {
    return JSON.parse(await fs.readFile(CREDS_FILE, "utf-8"))
  } catch {
    return []
  }
}

async function writeAll(entries: StoredEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(CREDS_FILE), { recursive: true })
  await fs.writeFile(CREDS_FILE, JSON.stringify(entries, null, 2))
}

/** Liste des application_id pour lesquelles l'utilisateur a enregistré un identifiant (sans secrets). */
export async function listCredentialAppIds(userId: number): Promise<number[]> {
  const all = await readAll()
  return all.filter((e) => e.utilisateur_id === userId).map((e) => e.application_id)
}

/** Identifiant déchiffré pour un utilisateur + application, ou null. */
export async function getCredential(userId: number, appId: number): Promise<PlainCredential | null> {
  const all = await readAll()
  const entry = all.find((e) => e.utilisateur_id === userId && e.application_id === appId)
  if (!entry) return null
  return {
    application_id: entry.application_id,
    login: entry.login,
    password: decryptSecret(entry.password_enc),
    note: entry.note_enc ? decryptSecret(entry.note_enc) : "",
    updatedAt: entry.updatedAt,
  }
}

/** Crée ou met à jour l'identifiant de l'utilisateur pour une application. */
export async function upsertCredential(
  userId: number,
  appId: number,
  login: string,
  password: string,
  note: string
): Promise<void> {
  const all = await readAll()
  const idx = all.findIndex((e) => e.utilisateur_id === userId && e.application_id === appId)
  const entry: StoredEntry = {
    utilisateur_id: userId,
    application_id: appId,
    login,
    password_enc: encryptSecret(password),
    note_enc: note ? encryptSecret(note) : "",
    updatedAt: new Date().toISOString(),
  }
  if (idx === -1) all.push(entry)
  else all[idx] = entry
  await writeAll(all)
}

/** Supprime l'identifiant de l'utilisateur pour une application. */
export async function deleteCredential(userId: number, appId: number): Promise<boolean> {
  const all = await readAll()
  const filtered = all.filter((e) => !(e.utilisateur_id === userId && e.application_id === appId))
  if (filtered.length === all.length) return false
  await writeAll(filtered)
  return true
}
