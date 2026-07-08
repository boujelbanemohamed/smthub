import { promises as fs } from "fs"
import path from "path"

/**
 * Favoris d'applications par utilisateur (stockage fichier JSON).
 */
const FAV_FILE = path.join(process.cwd(), "data", "app-favorites.json")

interface FavEntry {
  utilisateur_id: number
  application_id: number
}

async function readAll(): Promise<FavEntry[]> {
  try {
    return JSON.parse(await fs.readFile(FAV_FILE, "utf-8"))
  } catch {
    return []
  }
}

async function writeAll(entries: FavEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(FAV_FILE), { recursive: true })
  await fs.writeFile(FAV_FILE, JSON.stringify(entries, null, 2))
}

/** Liste des application_id favorites d'un utilisateur. */
export async function listFavorites(userId: number): Promise<number[]> {
  const all = await readAll()
  return all.filter((e) => e.utilisateur_id === userId).map((e) => e.application_id)
}

/** Bascule un favori. Renvoie true si désormais favori, false sinon. */
export async function toggleFavorite(userId: number, appId: number): Promise<boolean> {
  const all = await readAll()
  const idx = all.findIndex((e) => e.utilisateur_id === userId && e.application_id === appId)
  if (idx === -1) {
    all.push({ utilisateur_id: userId, application_id: appId })
    await writeAll(all)
    return true
  }
  all.splice(idx, 1)
  await writeAll(all)
  return false
}
