import { promises as fs } from "fs"
import path from "path"

// Sections incluses dans le rapport (contenu personnalisable).
export interface ReportSections {
  topApps: boolean
  topUsers: boolean
  byCategory: boolean
  unusedApps: boolean
  byHour: boolean
  banks: boolean // classement des banques (rapport global uniquement)
}

// Configuration des rapports de statistiques envoyés automatiquement par email.
export interface ReportConfig {
  enabled: boolean
  frequency: "weekly" | "monthly"
  hour: number // heure d'envoi (0-23, heure serveur)
  lastSent?: string | null // ISO date du dernier envoi
  // Emails explicitement exclus de l'envoi (par défaut, tout destinataire
  // éligible reçoit ; on retire ici ceux qu'on ne veut pas contacter).
  disabledRecipients: string[]
  // Contenu du rapport
  sections: ReportSections
}

const FILE = path.join(process.cwd(), "data", "report-config.json")

const DEFAULT_SECTIONS: ReportSections = {
  topApps: true, topUsers: true, byCategory: true, unusedApps: true, byHour: true, banks: true,
}

const DEFAULT: ReportConfig = {
  enabled: false, frequency: "weekly", hour: 7, lastSent: null,
  disabledRecipients: [], sections: { ...DEFAULT_SECTIONS },
}

export async function getReportConfig(): Promise<ReportConfig> {
  try {
    const cfg = JSON.parse(await fs.readFile(FILE, "utf-8"))
    return {
      ...DEFAULT,
      ...cfg,
      disabledRecipients: Array.isArray(cfg.disabledRecipients) ? cfg.disabledRecipients : [],
      sections: { ...DEFAULT_SECTIONS, ...(cfg.sections || {}) },
    }
  } catch {
    return { ...DEFAULT, sections: { ...DEFAULT_SECTIONS } }
  }
}

export async function saveReportConfig(cfg: ReportConfig): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(cfg, null, 2))
}

// Détermine si un rapport est dû : activé, l'heure d'envoi est atteinte, et on
// n'a pas déjà envoyé dans la fenêtre courante (semaine ISO ou mois).
export function isReportDue(now: Date, cfg: ReportConfig): boolean {
  if (!cfg.enabled) return false
  if (now.getHours() < cfg.hour) return false
  const last = cfg.lastSent ? new Date(cfg.lastSent) : null
  if (!last) return true
  if (cfg.frequency === "monthly") {
    // Nouvelle période si on a changé de mois calendaire.
    return now.getFullYear() !== last.getFullYear() || now.getMonth() !== last.getMonth()
  }
  // weekly : au moins 7 jours depuis le dernier envoi.
  return now.getTime() - last.getTime() >= 7 * 24 * 60 * 60 * 1000
}
