import { promises as fs } from "fs"
import path from "path"

// Suivi PERSISTANT des tentatives de connexion échouées et des verrouillages
// de compte. Stocké dans data/login-attempts.json (survit aux redémarrages,
// contrairement à l'ancien rate-limit en mémoire). Clé = email (minuscule).

const FILE = path.join(process.cwd(), "data", "login-attempts.json")

interface AttemptRecord {
  fails: number
  lockedUntil: string | null // ISO ; null = non verrouillé
  updated_at: string
}

type Store = Record<string, AttemptRecord>

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

const key = (email: string) => (email || "").trim().toLowerCase()

export interface LockState {
  locked: boolean
  minutesLeft: number
  fails: number
}

// État courant du verrouillage pour un email. Purge automatiquement un
// verrouillage expiré (déverrouillage après la durée configurée).
export async function getLockState(email: string): Promise<LockState> {
  const all = await readAll()
  const rec = all[key(email)]
  if (!rec) return { locked: false, minutesLeft: 0, fails: 0 }
  if (rec.lockedUntil) {
    const until = new Date(rec.lockedUntil).getTime()
    if (Date.now() < until) {
      return { locked: true, minutesLeft: Math.ceil((until - Date.now()) / 60000), fails: rec.fails }
    }
    // Verrou expiré → on réinitialise.
    delete all[key(email)]
    await writeAll(all)
    return { locked: false, minutesLeft: 0, fails: 0 }
  }
  return { locked: false, minutesLeft: 0, fails: rec.fails }
}

// Enregistre un échec. Verrouille si le seuil est atteint. Retourne l'état
// résultant (dont le nombre de tentatives restantes).
export async function recordFailure(
  email: string,
  maxAttempts: number,
  lockMinutes: number
): Promise<{ locked: boolean; minutesLeft: number; remaining: number }> {
  const all = await readAll()
  const k = key(email)
  const rec: AttemptRecord = all[k] || { fails: 0, lockedUntil: null, updated_at: "" }
  rec.fails += 1
  rec.updated_at = new Date().toISOString()
  if (rec.fails >= maxAttempts) {
    const until = new Date(Date.now() + lockMinutes * 60000)
    rec.lockedUntil = until.toISOString()
    all[k] = rec
    await writeAll(all)
    return { locked: true, minutesLeft: Math.ceil((until.getTime() - Date.now()) / 60000), remaining: 0 }
  }
  all[k] = rec
  await writeAll(all)
  return { locked: false, minutesLeft: 0, remaining: Math.max(0, maxAttempts - rec.fails) }
}

// Connexion réussie → on efface le compteur.
export async function clearFailures(email: string): Promise<void> {
  const all = await readAll()
  if (all[key(email)]) {
    delete all[key(email)]
    await writeAll(all)
  }
}

// Déverrouillage manuel par un administrateur.
export async function unlockAccount(email: string): Promise<void> {
  await clearFailures(email)
}

// Liste des comptes actuellement verrouillés (verrous expirés ignorés).
export async function listLocked(): Promise<{ email: string; minutesLeft: number; fails: number }[]> {
  const all = await readAll()
  const now = Date.now()
  const out: { email: string; minutesLeft: number; fails: number }[] = []
  for (const [email, rec] of Object.entries(all)) {
    if (rec.lockedUntil) {
      const until = new Date(rec.lockedUntil).getTime()
      if (now < until) {
        out.push({ email, minutesLeft: Math.ceil((until - now) / 60000), fails: rec.fails })
      }
    }
  }
  return out
}
