import { promises as fs } from "fs"
import path from "path"

// Un groupe est un ensemble nommé et persistant d'utilisateurs. Il sert de
// raccourci pour accorder/révoquer l'accès à des applications à tous ses
// membres en une fois. Les accès restent stockés par utilisateur (additifs) :
// modifier un groupe ne resynchronise PAS automatiquement les accès existants.
export interface UserGroup {
  id: string
  nom: string
  member_ids: number[]
  banque_id?: number | null
  created_at: string
}

const FILE = path.join(process.cwd(), "data", "user-groups.json")

export async function listGroups(): Promise<UserGroup[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"))
  } catch {
    return []
  }
}

async function save(items: UserGroup[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(items, null, 2))
}

function normalizeIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  return Array.from(new Set(ids.map((x) => Number(x)).filter((n) => !Number.isNaN(n))))
}

export async function addGroup(nom: string, memberIds: unknown, banqueId?: number | null): Promise<UserGroup> {
  const items = await listGroups()
  const group: UserGroup = {
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nom: nom.trim(),
    member_ids: normalizeIds(memberIds),
    banque_id: banqueId ?? null,
    created_at: new Date().toISOString(),
  }
  items.unshift(group)
  await save(items)
  return group
}

export async function updateGroup(
  id: string,
  updates: { nom?: string; member_ids?: unknown }
): Promise<UserGroup | null> {
  const items = await listGroups()
  const group = items.find((g) => g.id === id)
  if (!group) return null
  if (typeof updates.nom === "string" && updates.nom.trim()) group.nom = updates.nom.trim()
  if (updates.member_ids !== undefined) group.member_ids = normalizeIds(updates.member_ids)
  await save(items)
  return group
}

export async function deleteGroup(id: string): Promise<boolean> {
  const items = await listGroups()
  const next = items.filter((g) => g.id !== id)
  if (next.length === items.length) return false
  await save(next)
  return true
}

export async function getGroup(id: string): Promise<UserGroup | null> {
  const items = await listGroups()
  return items.find((g) => g.id === id) || null
}
