import { promises as fs } from "fs"
import path from "path"

export type NotificationType =
  | "access_granted"
  | "access_revoked"
  | "announcement"
  | "maintenance"
  | "profile_updated"
  | "bank_user_created"

export interface Notification {
  id: string
  userId: number
  type: NotificationType
  message: string
  link?: string | null
  read: boolean
  created_at: string
}

const FILE = path.join(process.cwd(), "data", "notifications.json")
const MAX_PER_USER = 50

async function readAll(): Promise<Notification[]> {
  try {
    const items = JSON.parse(await fs.readFile(FILE, "utf-8"))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

async function writeAll(items: Notification[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(items, null, 2))
}

function newId(): string {
  return `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Crée une notification pour un utilisateur. Ne bloque jamais l'appelant en cas
// d'erreur (les notifications sont un « plus », pas critiques).
export async function notify(userId: number, n: { type: NotificationType; message: string; link?: string | null }): Promise<void> {
  try {
    if (typeof userId !== "number") return
    const all = await readAll()
    all.push({ id: newId(), userId, type: n.type, message: n.message, link: n.link ?? null, read: false, created_at: new Date().toISOString() })
    // Élagage : on garde au plus MAX_PER_USER notifications par utilisateur.
    const byUser = new Map<number, Notification[]>()
    for (const it of all) {
      const arr = byUser.get(it.userId) || []
      arr.push(it); byUser.set(it.userId, arr)
    }
    let pruned: Notification[] = []
    for (const [, arr] of byUser) {
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      pruned = pruned.concat(arr.slice(0, MAX_PER_USER))
    }
    await writeAll(pruned)
  } catch {
    /* silencieux */
  }
}

export async function notifyMany(userIds: number[], n: { type: NotificationType; message: string; link?: string | null }): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((x) => typeof x === "number")))
  for (const uid of unique) await notify(uid, n)
}

export async function listForUser(userId: number, limit = 30): Promise<Notification[]> {
  const all = await readAll()
  return all
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
}

export async function unreadCount(userId: number): Promise<number> {
  const all = await readAll()
  return all.filter((n) => n.userId === userId && !n.read).length
}

export async function markRead(userId: number, ids: string[]): Promise<void> {
  const set = new Set(ids)
  const all = await readAll()
  let changed = false
  for (const n of all) {
    if (n.userId === userId && set.has(n.id) && !n.read) { n.read = true; changed = true }
  }
  if (changed) await writeAll(all)
}

export async function markAllRead(userId: number): Promise<void> {
  const all = await readAll()
  let changed = false
  for (const n of all) {
    if (n.userId === userId && !n.read) { n.read = true; changed = true }
  }
  if (changed) await writeAll(all)
}
