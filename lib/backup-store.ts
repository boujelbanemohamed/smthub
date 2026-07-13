import { promises as fs } from "fs"
import path from "path"
import { createZip, type ZipEntry } from "@/lib/zip-writer"

// Dossier où sont stockées les archives de sauvegarde. Doit être IDENTIQUE à
// celui utilisé par scripts/backup.sh (le cron) pour que l'admin voie aussi les
// sauvegardes automatiques. Par défaut : <projet>/backups (surchargeable).
export function backupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), "backups")
}

const DATA_DIR = path.join(process.cwd(), "data")
const ENV_FILE = path.join(process.cwd(), ".env.production")

// Nom d'archive valide : uniquement le motif attendu, sans séparateur de chemin
// (empêche tout accès en dehors du dossier de sauvegarde — path traversal).
const NAME_RE = /^smthub-backup-[0-9A-Za-z_.:-]+\.(zip|tar\.gz)$/

export function isValidBackupName(name: string): boolean {
  return typeof name === "string" && NAME_RE.test(name) && !name.includes("/") && !name.includes("\\")
}

export interface BackupInfo {
  name: string
  size: number
  created_at: string
  kind: "zip" | "tar.gz"
}

export async function listBackups(): Promise<BackupInfo[]> {
  const dir = backupDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const out: BackupInfo[] = []
  for (const name of entries) {
    if (!isValidBackupName(name)) continue
    try {
      const st = await fs.stat(path.join(dir, name))
      if (!st.isFile()) continue
      out.push({
        name,
        size: st.size,
        created_at: st.mtime.toISOString(),
        kind: name.endsWith(".tar.gz") ? "tar.gz" : "zip",
      })
    } catch {
      // fichier disparu entre-temps → on l'ignore
    }
  }
  // Plus récentes en premier.
  return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

// Parcourt récursivement un dossier et renvoie la liste des fichiers avec leur
// chemin relatif (séparateur « / »).
async function walk(root: string, base = ""): Promise<{ rel: string; abs: string }[]> {
  const out: { rel: string; abs: string }[] = []
  let items: import("fs").Dirent[]
  try {
    items = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const it of items) {
    const abs = path.join(root, it.name)
    const rel = base ? `${base}/${it.name}` : it.name
    if (it.isDirectory()) {
      out.push(...(await walk(abs, rel)))
    } else if (it.isFile()) {
      out.push({ rel, abs })
    }
  }
  return out
}

// Crée une sauvegarde (archive .zip) contenant tout le dossier data/ et, s'il
// existe, .env.production (indispensable pour relire le coffre-fort chiffré).
export async function createBackup(): Promise<BackupInfo> {
  const dir = backupDir()
  await fs.mkdir(dir, { recursive: true })

  const entries: ZipEntry[] = []
  for (const f of await walk(DATA_DIR)) {
    entries.push({ name: `data/${f.rel}`, data: await fs.readFile(f.abs) })
  }
  try {
    const env = await fs.readFile(ENV_FILE)
    entries.push({ name: ".env.production", data: env })
  } catch {
    // pas de .env.production (ex. mode .env.local en dev) → on ne l'inclut pas
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19)
  const name = `smthub-backup-${ts}.zip`
  const dest = path.join(dir, name)
  const buf = createZip(entries)
  await fs.writeFile(dest, buf)
  await fs.chmod(dest, 0o600).catch(() => {})

  return { name, size: buf.length, created_at: new Date().toISOString(), kind: "zip" }
}

// Renvoie le chemin absolu d'une archive (après validation stricte du nom).
export async function resolveBackup(name: string): Promise<string | null> {
  if (!isValidBackupName(name)) return null
  const abs = path.join(backupDir(), name)
  try {
    const st = await fs.stat(abs)
    return st.isFile() ? abs : null
  } catch {
    return null
  }
}

export async function deleteBackup(name: string): Promise<boolean> {
  const abs = await resolveBackup(name)
  if (!abs) return false
  await fs.rm(abs, { force: true })
  return true
}

// Supprime les archives plus vieilles que `days` jours. Renvoie le nombre
// d'archives supprimées.
export async function pruneOldBackups(days: number): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const list = await listBackups()
  let removed = 0
  for (const b of list) {
    if (new Date(b.created_at).getTime() < cutoff) {
      if (await deleteBackup(b.name)) removed++
    }
  }
  return removed
}
