import { promises as fs } from "fs"
import path from "path"

export interface Announcement {
  id: string
  message: string
  level: "info" | "warning" | "success"
  active: boolean
  created_at: string
  created_by: string
  // Programmation : si start_date/end_date sont nuls → annonce permanente.
  // Sinon l'annonce n'est visible qu'entre ces deux dates (ISO 8601).
  start_date?: string | null
  end_date?: string | null
  // Ciblage de l'audience : tout le monde, un groupe, ou des utilisateurs précis.
  audience?: "all" | "group" | "users"
  group_id?: string | null
  user_ids?: number[]
  // L'utilisateur peut-il fermer l'annonce ? (true par défaut). Si false,
  // la bannière reste affichée sans croix de fermeture.
  dismissible?: boolean
}

// Une annonce est active dans le temps si elle est active ET (permanente OU
// l'instant présent est dans la fenêtre [start_date, end_date]).
export function isAnnouncementVisible(a: Announcement, now: Date = new Date()): boolean {
  if (!a.active) return false
  const t = now.getTime()
  if (a.start_date && t < new Date(a.start_date).getTime()) return false
  if (a.end_date && t > new Date(a.end_date).getTime()) return false
  return true
}

// L'annonce cible-t-elle cet utilisateur ? (indépendamment des dates)
//  - "all" (ou audience absente) → tout le monde
//  - "users" → l'utilisateur doit figurer dans user_ids
//  - "group" → l'utilisateur doit être membre du groupe (memberIds fourni par l'appelant)
export function isAnnouncementForUser(a: Announcement, userId: number, groupMemberIds: number[] = []): boolean {
  const aud = a.audience || "all"
  if (aud === "all") return true
  if (aud === "users") return Array.isArray(a.user_ids) && a.user_ids.includes(userId)
  if (aud === "group") return groupMemberIds.includes(userId)
  return true
}

const FILE = path.join(process.cwd(), "data", "announcements.json")

export async function listAnnouncements(): Promise<Announcement[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"))
  } catch {
    return []
  }
}

async function save(items: Announcement[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(items, null, 2))
}

export async function addAnnouncement(
  message: string,
  level: Announcement["level"],
  createdBy: string,
  startDate?: string | null,
  endDate?: string | null,
  audience: Announcement["audience"] = "all",
  groupId?: string | null,
  userIds?: number[],
  dismissible: boolean = true
): Promise<Announcement> {
  const items = await listAnnouncements()
  const item: Announcement = {
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message,
    level,
    active: true,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    start_date: startDate || null,
    end_date: endDate || null,
    audience: audience || "all",
    group_id: audience === "group" ? (groupId || null) : null,
    user_ids: audience === "users" ? (Array.isArray(userIds) ? userIds : []) : [],
    dismissible,
  }
  items.unshift(item)
  await save(items)
  return item
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const items = await listAnnouncements()
  const next = items.filter((a) => a.id !== id)
  if (next.length === items.length) return false
  await save(next)
  return true
}

export async function toggleAnnouncement(id: string): Promise<Announcement | null> {
  const items = await listAnnouncements()
  const item = items.find((a) => a.id === id)
  if (!item) return null
  item.active = !item.active
  await save(items)
  return item
}
