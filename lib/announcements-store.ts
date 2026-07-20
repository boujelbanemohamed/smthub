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
  // Ciblage de l'audience : tout le monde, une banque, un groupe, ou des
  // utilisateurs précis.
  audience?: "all" | "bank" | "group" | "users"
  group_id?: string | null
  bank_id?: number | null
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
export function isAnnouncementForUser(
  a: Announcement,
  userId: number,
  groupMemberIds: number[] = [],
  userBankId: number | null = null
): boolean {
  const aud = a.audience || "all"
  if (aud === "all") return true
  if (aud === "users") return Array.isArray(a.user_ids) && a.user_ids.includes(userId)
  if (aud === "group") return groupMemberIds.includes(userId)
  if (aud === "bank") return a.bank_id != null && userBankId != null && Number(a.bank_id) === Number(userBankId)
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
  dismissible: boolean = true,
  bankId?: number | null
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
    bank_id: audience === "bank" ? (bankId != null ? Number(bankId) : null) : null,
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

// Met à jour une annonce existante (message, niveau, dates, audience, fermeture…).
// Seuls les champs fournis sont modifiés ; l'id, l'auteur et la date de création
// restent inchangés.
export async function updateAnnouncement(
  id: string,
  fields: Partial<Pick<Announcement, "message" | "level" | "start_date" | "end_date" | "audience" | "group_id" | "bank_id" | "user_ids" | "dismissible">>
): Promise<Announcement | null> {
  const items = await listAnnouncements()
  const item = items.find((a) => a.id === id)
  if (!item) return null

  if (typeof fields.message === "string" && fields.message.trim()) item.message = fields.message.trim()
  if (fields.level && ["info", "warning", "success"].includes(fields.level)) item.level = fields.level
  if (fields.audience && ["all", "bank", "group", "users"].includes(fields.audience)) {
    item.audience = fields.audience
    item.group_id = fields.audience === "group" ? (fields.group_id || null) : null
    item.bank_id = fields.audience === "bank" ? (fields.bank_id != null ? Number(fields.bank_id) : null) : null
    item.user_ids = fields.audience === "users" ? (Array.isArray(fields.user_ids) ? fields.user_ids : []) : []
  }
  if (fields.start_date !== undefined) item.start_date = fields.start_date || null
  if (fields.end_date !== undefined) item.end_date = fields.end_date || null
  if (typeof fields.dismissible === "boolean") item.dismissible = fields.dismissible

  await save(items)
  return item
}

export async function toggleAnnouncement(id: string): Promise<Announcement | null> {
  const items = await listAnnouncements()
  const item = items.find((a) => a.id === id)
  if (!item) return null
  item.active = !item.active
  await save(items)
  return item
}
