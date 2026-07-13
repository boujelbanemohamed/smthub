import { promises as fs } from "fs"
import path from "path"

// Configuration de la sauvegarde automatique, pilotable depuis l'admin.
// Remplace le besoin d'un cron système : c'est l'application elle-même qui
// déclenche les sauvegardes selon ces réglages (voir lib/backup-scheduler.ts).
export interface BackupConfig {
  enabled: boolean
  frequency: "daily" | "weekly"
  hour: number // 0–23 (heure locale du serveur)
  weekday: number // 0 = dimanche … 6 = samedi (utilisé si frequency = weekly)
  retentionDays: number // suppression auto des archives plus vieilles
  lastRun: string | null // ISO de la dernière sauvegarde automatique
  updatedBy?: string
  updatedAt?: string
}

const FILE = path.join(process.cwd(), "data", "backup-config.json")

export const DEFAULT_CONFIG: BackupConfig = {
  enabled: false,
  frequency: "daily",
  hour: 2,
  weekday: 1,
  retentionDays: 14,
  lastRun: null,
}

export async function getBackupConfig(): Promise<BackupConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf-8"))
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveBackupConfig(cfg: BackupConfig): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(cfg, null, 2))
}

// Valide et normalise une configuration reçue du client.
export function sanitizeConfig(input: any, previous: BackupConfig): BackupConfig {
  const frequency = input?.frequency === "weekly" ? "weekly" : "daily"
  const hour = Math.min(23, Math.max(0, Number.isFinite(+input?.hour) ? Math.floor(+input.hour) : previous.hour))
  const weekday = Math.min(6, Math.max(0, Number.isFinite(+input?.weekday) ? Math.floor(+input.weekday) : previous.weekday))
  const retentionDays = Math.min(365, Math.max(1, Number.isFinite(+input?.retentionDays) ? Math.floor(+input.retentionDays) : previous.retentionDays))
  return {
    ...previous,
    enabled: !!input?.enabled,
    frequency,
    hour,
    weekday,
    retentionDays,
  }
}

// Renvoie l'horodatage de la dernière occurrence planifiée <= maintenant,
// ou null si aucune (ex. hebdomadaire dont le jour n'est pas encore passé).
export function lastScheduledOccurrence(now: Date, cfg: BackupConfig): Date | null {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  d.setHours(cfg.hour)
  if (cfg.frequency === "daily") {
    if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1)
    return d
  }
  // Hebdomadaire : on recule jour par jour jusqu'à tomber sur le bon jour.
  const cur = new Date(d)
  for (let i = 0; i < 8; i++) {
    if (cur.getDay() === cfg.weekday && cur.getTime() <= now.getTime()) return cur
    cur.setDate(cur.getDate() - 1)
  }
  return null
}

// Une sauvegarde est-elle due maintenant ? (activée ET la dernière occurrence
// planifiée est postérieure à la dernière sauvegarde effectuée).
export function isBackupDue(now: Date, cfg: BackupConfig): boolean {
  if (!cfg.enabled) return false
  const occ = lastScheduledOccurrence(now, cfg)
  if (!occ) return false
  if (!cfg.lastRun) return true
  return new Date(cfg.lastRun).getTime() < occ.getTime()
}
