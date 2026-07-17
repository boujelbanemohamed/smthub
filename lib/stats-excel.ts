import type { AggregatedStats } from "./stats-agg"
import type { ReportSections } from "./report-config"

const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const ALL_SECTIONS: ReportSections = { topApps: true, topUsers: true, byCategory: true, unusedApps: true, byHour: true, banks: true }

// Construit un classeur Excel (table HTML qu'Excel ouvre nativement) à partir des
// statistiques agrégées. Utilisé pour les rapports planifiés par email.
// `meta.sections` permet de choisir le contenu (sections incluses).
export function buildReportXls(
  agg: AggregatedStats,
  meta: { titre: string; periode: string; banque: string; includeBanks: boolean; sections?: ReportSections }
): string {
  const S = meta.sections || ALL_SECTIONS
  const total = agg.totalOpens
  const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1).replace(".", ",") + "%" : "0%")
  const th = 'style="background:#217346;color:#fff;font-weight:bold;border:1px solid #ccc;padding:4px 8px"'
  const hd = 'style="background:#d9ead3;font-weight:bold;border:1px solid #ccc;padding:4px 8px"'
  const td = 'style="border:1px solid #ccc;padding:4px 8px"'
  const tdr = 'style="border:1px solid #ccc;padding:4px 8px;text-align:right"'

  const sections: string[] = []

  if (S.topApps) {
    const appRows = agg.topApps.map((a, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${esc(a.nom)}</td><td ${tdr}>${a.count}</td><td ${tdr}>${pct(a.count)}</td></tr>`).join("")
    sections.push(`<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Applications les plus ouvertes</td></tr>
<tr><td ${hd}>Rang</td><td ${hd}>Application</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${appRows || `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}`)
  }
  if (S.topUsers) {
    const userRows = agg.topUsers.map((u, i) => `<tr><td ${td}>${i + 1}</td><td ${td} colspan="2">${esc(u.nom)}</td><td ${tdr}>${u.count}</td></tr>`).join("")
    sections.push(`<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Utilisateurs les plus actifs</td></tr>
<tr><td ${hd}>Rang</td><td ${hd} colspan="2">Utilisateur</td><td ${hd}>Ouvertures</td></tr>
${userRows || `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}`)
  }
  if (S.byCategory) {
    const catRows = agg.byCategory.map((c) => `<tr><td ${td} colspan="2">${esc(c.category)}</td><td ${tdr}>${c.count}</td><td ${tdr}>${pct(c.count)}</td></tr>`).join("")
    sections.push(`<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Ouvertures par catégorie</td></tr>
<tr><td ${hd} colspan="2">Catégorie</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${catRows || `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}`)
  }
  if (S.unusedApps) {
    const unusedRows = agg.appUsage.filter((a) => a.count === 0).map((a) => `<tr><td ${td} colspan="4">${esc(a.nom)} (${esc(a.category)})</td></tr>`).join("")
    sections.push(`<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Applications jamais utilisées sur la période</td></tr>
${unusedRows || `<tr><td ${td} colspan="4">Aucune (toutes les applications ont été ouvertes)</td></tr>`}`)
  }
  if (S.byHour) {
    const hourRows = agg.byHour.map((h) => `<tr><td ${td}>${h.hour}h</td><td ${tdr} colspan="3">${h.count}</td></tr>`).join("")
    sections.push(`<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Répartition par heure</td></tr>
<tr><td ${hd}>Heure</td><td ${hd} colspan="3">Ouvertures</td></tr>
${hourRows}`)
  }
  if (meta.includeBanks && S.banks && agg.byBank.length > 0) {
    const rows = agg.byBank.map((b, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${esc(b.nom)}</td><td ${tdr}>${b.count}</td><td ${tdr}>${pct(b.count)}</td></tr>`).join("")
    sections.push(`<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Banques les plus actives</td></tr>
<tr><td ${hd}>Rang</td><td ${hd}>Banque</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${rows}`)
  }

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table>
<tr><td colspan="4" style="font-size:16px;font-weight:bold;color:#217346">Monétique Tunisie — ${esc(meta.titre)}</td></tr>
<tr><td colspan="4">Banque : ${esc(meta.banque)} | Période : ${esc(meta.periode)} | Total d'ouvertures : ${total}</td></tr>
${sections.join("\n")}
</table></body></html>`
}
