import { promises as fs } from "fs"
import path from "path"
import { getBank } from "./banks-store"

const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")

async function readAccess(): Promise<any[]> {
  try {
    return JSON.parse(await fs.readFile(ACCESS_FILE, "utf-8"))
  } catch {
    return []
  }
}

async function writeAccess(access: any[]): Promise<void> {
  await fs.mkdir(path.dirname(ACCESS_FILE), { recursive: true })
  await fs.writeFile(ACCESS_FILE, JSON.stringify(access, null, 2))
}

// Accorde à un utilisateur l'accès à TOUTES les applications de sa banque
// (idempotent : n'ajoute que les accès manquants). Utilisé pour donner à un
// admin de banque, dès sa création, l'accès par défaut à toutes les applis.
export async function grantAllBankApps(userId: number, banqueId: number): Promise<void> {
  const bank = await getBank(banqueId)
  if (!bank) return
  const access = await readAccess()
  let changed = false
  for (const appId of bank.app_ids) {
    if (!access.some((a) => a.utilisateur_id === userId && a.application_id === appId)) {
      access.push({ utilisateur_id: userId, application_id: appId })
      changed = true
    }
  }
  if (changed) await writeAccess(access)
}

// Migration idempotente : pour chaque admin de banque jamais initialisé, on lui
// accorde l'accès à toutes les applis de sa banque et on pose un marqueur
// `access_initialized` afin de ne PAS ré-accorder si l'admin décoche ensuite des
// applications. Appelée au démarrage du serveur (instrumentation).
export async function ensureBankAdminsSeeded(): Promise<void> {
  let users: any[]
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
  } catch {
    return
  }
  let usersChanged = false
  for (const u of users) {
    if (u.role === "admin" && u.banque_id != null && !u.access_initialized) {
      await grantAllBankApps(u.id, u.banque_id)
      u.access_initialized = true
      usersChanged = true
    }
  }
  if (usersChanged) {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true })
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
  }
}
