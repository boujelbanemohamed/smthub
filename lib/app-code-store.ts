import { promises as fs } from "fs"
import path from "path"

// Un « dépôt » = un chargement de code par l'administrateur pour une application.
// Il peut contenir plusieurs fichiers (dossier) ou une archive .zip, plus une note.
export interface CodeDeposit {
  id: string
  application_id: number
  note: string
  created_at: string
  created_by: string
  kind: "zip" | "folder"
  files: { path: string; size: number }[]
  total_size: number
}

const META_FILE = path.join(process.cwd(), "data", "app-code.json")
const FILES_ROOT = path.join(process.cwd(), "data", "app-code")

async function readMeta(): Promise<CodeDeposit[]> {
  try {
    const items = JSON.parse(await fs.readFile(META_FILE, "utf-8"))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

async function writeMeta(items: CodeDeposit[]): Promise<void> {
  await fs.mkdir(path.dirname(META_FILE), { recursive: true })
  await fs.writeFile(META_FILE, JSON.stringify(items, null, 2))
}

// Nettoie un chemin relatif fourni par le client : retire les « .. », les
// slashes de tête et les caractères dangereux → empêche toute écriture hors
// du dossier du dépôt (path traversal).
export function sanitizeRelPath(input: string): string {
  const parts = String(input || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..")
  const clean = parts.join("/")
  return clean || "fichier"
}

function depositDir(appId: number, depositId: string): string {
  return path.join(FILES_ROOT, String(appId), depositId)
}

export async function listDeposits(appId: number): Promise<CodeDeposit[]> {
  const all = await readMeta()
  return all
    .filter((d) => d.application_id === appId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export async function getDeposit(appId: number, depositId: string): Promise<CodeDeposit | null> {
  const all = await readMeta()
  return all.find((d) => d.application_id === appId && d.id === depositId) || null
}

export async function addDeposit(
  appId: number,
  note: string,
  createdBy: string,
  incoming: { path: string; data: Buffer }[],
  kind: CodeDeposit["kind"]
): Promise<CodeDeposit> {
  const id = `dep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const dir = depositDir(appId, id)

  const files: { path: string; size: number }[] = []
  for (const f of incoming) {
    const rel = sanitizeRelPath(f.path)
    const dest = path.join(dir, rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, f.data)
    files.push({ path: rel, size: f.data.length })
  }

  const deposit: CodeDeposit = {
    id,
    application_id: appId,
    note: (note || "").trim(),
    created_at: new Date().toISOString(),
    created_by: createdBy,
    kind,
    files,
    total_size: files.reduce((s, f) => s + f.size, 0),
  }

  const all = await readMeta()
  all.push(deposit)
  await writeMeta(all)
  return deposit
}

export async function deleteDeposit(appId: number, depositId: string): Promise<boolean> {
  const all = await readMeta()
  const exists = all.some((d) => d.application_id === appId && d.id === depositId)
  if (!exists) return false
  await writeMeta(all.filter((d) => !(d.application_id === appId && d.id === depositId)))
  try {
    await fs.rm(depositDir(appId, depositId), { recursive: true, force: true })
  } catch {
    // dossier déjà absent → on ignore
  }
  return true
}

// Supprime tous les dépôts (et fichiers) d'une application — appelé quand
// l'application elle-même est supprimée.
export async function deleteAllForApp(appId: number): Promise<void> {
  const all = await readMeta()
  await writeMeta(all.filter((d) => d.application_id !== appId))
  try {
    await fs.rm(path.join(FILES_ROOT, String(appId)), { recursive: true, force: true })
  } catch {
    // rien à supprimer
  }
}

// Lit sur disque tous les fichiers d'un dépôt (pour générer l'archive .zip).
export async function readDepositFiles(deposit: CodeDeposit): Promise<{ name: string; data: Buffer }[]> {
  const dir = depositDir(deposit.application_id, deposit.id)
  const out: { name: string; data: Buffer }[] = []
  for (const f of deposit.files) {
    try {
      const data = await fs.readFile(path.join(dir, f.path))
      out.push({ name: f.path, data })
    } catch {
      // fichier manquant sur disque → on l'ignore
    }
  }
  return out
}
