import { promises as fs } from "fs"
import path from "path"

// Fermetures d'annonces enregistrées côté serveur (par compte utilisateur).
// Permet de ne plus réafficher une annonce fermée, sur n'importe quel appareil,
// et de savoir qui a fermé quelle annonce (statistiques).
export interface Dismissal {
  announcement_id: string
  utilisateur_id: number
  user_name: string
  at: string
}

const FILE = path.join(process.cwd(), "data", "announcement-dismissals.json")

export async function listDismissals(): Promise<Dismissal[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"))
  } catch {
    return []
  }
}

async function save(items: Dismissal[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(items, null, 2))
}

export async function addDismissal(announcementId: string, userId: number, userName: string): Promise<void> {
  const items = await listDismissals()
  if (items.some((d) => d.announcement_id === announcementId && d.utilisateur_id === userId)) return
  items.push({ announcement_id: announcementId, utilisateur_id: userId, user_name: userName, at: new Date().toISOString() })
  await save(items)
}

export async function getDismissedIdsForUser(userId: number): Promise<Set<string>> {
  const items = await listDismissals()
  return new Set(items.filter((d) => d.utilisateur_id === userId).map((d) => d.announcement_id))
}
