import { promises as fs } from "fs"
import path from "path"

// Suivi de présence : dernière activité connue de chaque utilisateur.
// Un utilisateur est considéré « connecté » si sa dernière activité date de
// moins de CONNECTED_THRESHOLD_MS (le client envoie un « heartbeat » régulier).
export const CONNECTED_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

const FILE = path.join(process.cwd(), "data", "presence.json")
const LOGIN_FILE = path.join(process.cwd(), "data", "last-login.json")

type PresenceMap = Record<string, string> // userId -> ISO date

async function read(): Promise<PresenceMap> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"))
  } catch {
    return {}
  }
}

async function write(map: PresenceMap): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(map, null, 2))
}

// Enregistre l'activité de l'utilisateur (maintenant)
export async function touchPresence(userId: number): Promise<void> {
  const map = await read()
  map[String(userId)] = new Date().toISOString()
  await write(map)
}

// Marque explicitement un utilisateur hors-ligne (déconnexion)
export async function clearPresence(userId: number): Promise<void> {
  const map = await read()
  delete map[String(userId)]
  await write(map)
}

export async function getPresenceMap(): Promise<PresenceMap> {
  return read()
}

export function isConnected(lastSeen: string | undefined, now: number = Date.now()): boolean {
  if (!lastSeen) return false
  const t = new Date(lastSeen).getTime()
  if (Number.isNaN(t)) return false
  return now - t <= CONNECTED_THRESHOLD_MS
}

// --- Dernière connexion (login) : persistée, NON effacée à la déconnexion ---

async function readLogin(): Promise<PresenceMap> {
  try {
    return JSON.parse(await fs.readFile(LOGIN_FILE, "utf-8"))
  } catch {
    return {}
  }
}

// Enregistre l'horodatage de la dernière connexion réussie de l'utilisateur.
export async function touchLastLogin(userId: number): Promise<void> {
  const map = await readLogin()
  map[String(userId)] = new Date().toISOString()
  await fs.mkdir(path.dirname(LOGIN_FILE), { recursive: true })
  await fs.writeFile(LOGIN_FILE, JSON.stringify(map, null, 2))
}

export async function getLastLoginMap(): Promise<PresenceMap> {
  return readLogin()
}
