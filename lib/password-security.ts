import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"

// Métadonnées de sécurité des mots de passe, par utilisateur :
//  - changedAt : date du dernier changement (pour l'expiration)
//  - history   : hashes des N derniers mots de passe (anti-réutilisation)
//  - graceUntil: échéance de mise en conformité (compte désactivé au-delà)
// Stocké dans data/password-security.json.

const FILE = path.join(process.cwd(), "data", "password-security.json")

export interface PwdMeta {
  changedAt?: string
  history?: string[]
  graceUntil?: string | null
}

type Store = Record<string, PwdMeta>

async function readAll(): Promise<Store> {
  try {
    const d = JSON.parse(await fs.readFile(FILE, "utf-8"))
    return d && typeof d === "object" ? d : {}
  } catch {
    return {}
  }
}

async function writeAll(data: Store): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(data, null, 2))
}

export async function getMeta(userId: number): Promise<PwdMeta> {
  const all = await readAll()
  return all[String(userId)] || {}
}

// Enregistre un changement de mot de passe : met à jour changedAt, ajoute le
// nouveau hash à l'historique (tronqué à historyCount) et lève la période de
// grâce.
export async function recordPasswordChange(
  userId: number,
  newHash: string,
  historyCount: number
): Promise<void> {
  const all = await readAll()
  const meta = all[String(userId)] || {}
  const hist = Array.isArray(meta.history) ? meta.history.slice() : []
  hist.unshift(newHash)
  meta.history = historyCount > 0 ? hist.slice(0, historyCount) : []
  meta.changedAt = new Date().toISOString()
  meta.graceUntil = null
  all[String(userId)] = meta
  await writeAll(all)
}

// Vérifie qu'un mot de passe EN CLAIR ne réutilise pas l'un des N derniers.
export async function isPasswordReused(userId: number, plain: string): Promise<boolean> {
  const meta = await getMeta(userId)
  const hist = meta.history || []
  for (const h of hist) {
    try {
      if (await bcrypt.compare(plain, h)) return true
    } catch {
      /* hash invalide → ignoré */
    }
  }
  return false
}

// Positionne la période de grâce (si absente) et la retourne.
export async function ensureGrace(userId: number, graceHours: number): Promise<string> {
  const all = await readAll()
  const meta = all[String(userId)] || {}
  if (!meta.graceUntil) {
    meta.graceUntil = new Date(Date.now() + graceHours * 3600 * 1000).toISOString()
    all[String(userId)] = meta
    await writeAll(all)
  }
  return meta.graceUntil
}

export async function clearGrace(userId: number): Promise<void> {
  const all = await readAll()
  const meta = all[String(userId)]
  if (meta && meta.graceUntil) {
    meta.graceUntil = null
    all[String(userId)] = meta
    await writeAll(all)
  }
}

// Seed du changedAt au premier passage si inconnu (évite une expiration
// immédiate pour les comptes existants).
export async function ensureChangedAt(userId: number): Promise<string> {
  const all = await readAll()
  const meta = all[String(userId)] || {}
  if (!meta.changedAt) {
    meta.changedAt = new Date().toISOString()
    all[String(userId)] = meta
    await writeAll(all)
  }
  return meta.changedAt
}
