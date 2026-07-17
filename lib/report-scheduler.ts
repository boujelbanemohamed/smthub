import { promises as fs } from "fs"
import path from "path"
import { getReportConfig, saveReportConfig, isReportDue, type ReportConfig, type ReportSections } from "./report-config"
import { aggregate } from "./stats-agg"
import { buildReportXls } from "./stats-excel"
import { listBanks } from "./banks-store"
import { sendEmail } from "./email-service"
import { generateEmailFromTemplate } from "./email-templates"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")

const CHECK_INTERVAL_MS = 10 * 60 * 1000 // vérifie toutes les 10 minutes

declare global {
  // eslint-disable-next-line no-var
  var __smthubReportSchedulerStarted: boolean | undefined
}

async function readJson(file: string): Promise<any[]> {
  try { return JSON.parse(await fs.readFile(file, "utf-8")) } catch { return [] }
}

function periodBounds(freq: ReportConfig["frequency"]): { since: number; label: string } {
  const now = Date.now()
  const days = freq === "monthly" ? 30 : 7
  const since = now - days * 24 * 60 * 60 * 1000
  const fmt = (t: number) => new Date(t).toLocaleDateString("fr-FR")
  return { since, label: `${fmt(since)} → ${fmt(now)}` }
}

// Envoie les rapports : un rapport global aux super-admins, un rapport par banque
// aux admins de chaque banque. `disabled` = emails exclus, `sections` = contenu.
export async function sendReports(
  freq: ReportConfig["frequency"],
  disabled: string[] = [],
  sections?: ReportSections
): Promise<number> {
  const [logs, users, apps, banks] = await Promise.all([
    readJson(LOGS_FILE), readJson(USERS_FILE), readJson(APPLICATIONS_FILE), listBanks(),
  ])
  const { since, label } = periodBounds(freq)
  const opens = logs.filter((l: any) => l.action === "Ouverture application" && new Date(l.timestamp).getTime() >= since)
  const titre = freq === "monthly" ? "Rapport mensuel de statistiques" : "Rapport hebdomadaire de statistiques"
  const excluded = new Set(disabled.map((e) => String(e).toLowerCase()))
  const isExcluded = (email: string) => excluded.has(String(email).toLowerCase())
  let sent = 0

  // 1) Rapport global → super-admins (admin sans banque), hors exclus
  const supers = users.filter((u: any) => u.role === "admin" && (u.banque_id == null) && u.actif !== false && u.email && !isExcluded(u.email))
  if (supers.length > 0) {
    const agg = aggregate(opens, users, banks, apps)
    const xls = buildReportXls(agg, { titre, periode: label, banque: "Toutes", includeBanks: true, sections })
    for (const s of supers) {
      const mail = await buildReportEmail({ userName: s.nom, titre, periode: label, total: String(agg.totalOpens), banque: "Toutes" })
      const ok = await sendEmail({
        to: s.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: [{ filename: `statistiques-${freq}.xls`, content: "﻿" + xls, contentType: "application/vnd.ms-excel" }],
      })
      if (ok) sent++
    }
  }

  // 2) Rapport par banque → admins de la banque, hors exclus
  for (const bank of banks) {
    const bankAdmins = users.filter((u: any) => u.role === "admin" && u.banque_id === bank.id && u.actif !== false && u.email && !isExcluded(u.email))
    if (bankAdmins.length === 0) continue
    const bankUserIds = new Set(users.filter((u: any) => u.banque_id === bank.id).map((u: any) => u.id))
    const bankOpens = opens.filter((l: any) => typeof l.userId === "number" && bankUserIds.has(l.userId))
    const bankApps = apps.filter((a: any) => (bank.app_ids || []).includes(a.id))
    const agg = aggregate(bankOpens, users, banks, bankApps)
    const xls = buildReportXls(agg, { titre, periode: label, banque: bank.nom, includeBanks: false, sections })
    for (const a of bankAdmins) {
      const mail = await buildReportEmail({ userName: a.nom, titre, periode: label, total: String(agg.totalOpens), banque: bank.nom })
      const ok = await sendEmail({
        to: a.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: [{ filename: `statistiques-${bank.nom.replace(/[^a-zA-Z0-9_-]+/g, "_")}-${freq}.xls`, content: "﻿" + xls, contentType: "application/vnd.ms-excel" }],
      })
      if (ok) sent++
    }
  }
  return sent
}

// Construit l'email d'accompagnement à partir du modèle éditable « report »
// (onglet Configuration Emails). Repli sur un modèle codé en dur si absent.
async function buildReportEmail(vars: { userName: string; titre: string; periode: string; total: string; banque: string }): Promise<{ subject: string; html: string; text?: string }> {
  const gen = await generateEmailFromTemplate("report", vars)
  if (gen) return gen
  return {
    subject: `📊 ${vars.titre} — Monétique Tunisie`,
    html: reportEmailHtml(vars.userName, vars.titre, vars.periode, Number(vars.total) || 0, vars.banque === "Toutes" ? undefined : vars.banque),
  }
}

function reportEmailHtml(nom: string, titre: string, periode: string, total: number, banque?: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1877f2 0%, #166fe5 100%); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Monétique Tunisie</h1>
      </div>
      <div style="padding: 24px; background: #f8fafc;">
        <h2 style="color: #1877f2; margin-top: 0;">${titre}</h2>
        <p style="color: #475569;">Bonjour ${nom},</p>
        <p style="color: #475569; line-height: 1.6;">Veuillez trouver ci-joint le rapport de statistiques d'usage${banque ? ` de la banque <strong>${banque}</strong>` : ""} pour la période <strong>${periode}</strong>.</p>
        <p style="color: #475569;">Total d'ouvertures sur la période : <strong>${total}</strong>.</p>
        <p style="color: #64748b; font-size: 13px;">Le détail complet est dans le fichier Excel joint (applications, utilisateurs, catégories, heures de pointe, applications non utilisées).</p>
      </div>
      <div style="padding: 16px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 13px;">Rapport généré automatiquement.</p>
      </div>
    </div>`
}

async function tick(): Promise<void> {
  try {
    const cfg = await getReportConfig()
    if (!isReportDue(new Date(), cfg)) return
    const n = await sendReports(cfg.frequency, cfg.disabledRecipients, cfg.sections)
    await saveReportConfig({ ...cfg, lastSent: new Date().toISOString() })
    console.log(`[report-scheduler] Rapport ${cfg.frequency} envoyé (${n} email(s)).`)
  } catch (e) {
    console.error("[report-scheduler] Échec de l'envoi du rapport :", e)
  }
}

export function startReportScheduler(): void {
  if (globalThis.__smthubReportSchedulerStarted) return
  globalThis.__smthubReportSchedulerStarted = true
  setTimeout(() => { void tick() }, 45_000)
  setInterval(() => { void tick() }, CHECK_INTERVAL_MS)
  console.log("[report-scheduler] Planificateur de rapports démarré.")
}
