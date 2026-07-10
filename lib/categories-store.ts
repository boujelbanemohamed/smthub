import { promises as fs } from "fs"
import path from "path"

export interface Category {
  id: string
  name: string
}

const FILE = path.join(process.cwd(), "data", "categories.json")

// Catégories proposées par défaut si le fichier n'existe pas encore.
const DEFAULTS = ["Ressources Humaines", "Finance", "Production", "Communication", "Outils"]

async function seedIfMissing(): Promise<Category[]> {
  const items = DEFAULTS.map((name) => ({ id: makeId(name), name }))
  await save(items)
  return items
}

function makeId(name: string): string {
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}_${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12)}`
}

export async function listCategories(): Promise<Category[]> {
  try {
    const items = JSON.parse(await fs.readFile(FILE, "utf-8"))
    if (Array.isArray(items)) return items
    return await seedIfMissing()
  } catch {
    return await seedIfMissing()
  }
}

async function save(items: Category[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(items, null, 2))
}

// Ajoute une catégorie. Refuse les doublons (comparaison insensible à la casse).
export async function addCategory(name: string): Promise<Category | { error: string }> {
  const clean = name.trim()
  if (!clean) return { error: "Nom requis" }
  const items = await listCategories()
  if (items.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
    return { error: "Cette catégorie existe déjà" }
  }
  const item: Category = { id: makeId(clean), name: clean }
  items.push(item)
  items.sort((a, b) => a.name.localeCompare(b.name, "fr"))
  await save(items)
  return item
}

// Renomme une catégorie et répercute le nouveau nom sur les applications qui
// l'utilisaient (leur champ `category` est mis à jour en conséquence).
export async function renameCategory(id: string, name: string): Promise<Category | { error: string }> {
  const clean = name.trim()
  if (!clean) return { error: "Nom requis" }
  const items = await listCategories()
  const item = items.find((c) => c.id === id)
  if (!item) return { error: "Catégorie introuvable" }
  if (items.some((c) => c.id !== id && c.name.toLowerCase() === clean.toLowerCase())) {
    return { error: "Cette catégorie existe déjà" }
  }
  const oldName = item.name
  item.name = clean
  items.sort((a, b) => a.name.localeCompare(b.name, "fr"))
  await save(items)
  await propagateToApplications(oldName, clean)
  return item
}

// Supprime une catégorie ; les applications qui la portaient sont remises à
// « sans catégorie » (champ vidé) pour ne pas laisser de catégorie orpheline.
export async function deleteCategory(id: string): Promise<{ ok: boolean }> {
  const items = await listCategories()
  const item = items.find((c) => c.id === id)
  if (!item) return { ok: false }
  const next = items.filter((c) => c.id !== id)
  await save(next)
  await propagateToApplications(item.name, "")
  return { ok: true }
}

// Met à jour le champ `category` des applications dont la catégorie correspond
// à `oldName` (comparaison exacte). `newName` vide = retrait de la catégorie.
async function propagateToApplications(oldName: string, newName: string): Promise<void> {
  const APP_FILE = path.join(process.cwd(), "data", "applications.json")
  try {
    const apps = JSON.parse(await fs.readFile(APP_FILE, "utf-8"))
    if (!Array.isArray(apps)) return
    let changed = false
    for (const app of apps) {
      if ((app.category || "") === oldName) {
        app.category = newName
        changed = true
      }
    }
    if (changed) await fs.writeFile(APP_FILE, JSON.stringify(apps, null, 2))
  } catch {
    // pas de fichier applications → rien à répercuter
  }
}
