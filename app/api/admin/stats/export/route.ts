import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { bankUserIds, getBank, listBanks } from "@/lib/banks-store"
import { aggregate } from "@/lib/stats-agg"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")

function inRange(ts: string, startDate?: string | null, endDate?: string | null): boolean {
  const t = new Date(ts).getTime()
  if (startDate) {
    const s = new Date(startDate + "T00:00:00").getTime()
    if (!Number.isNaN(s) && t < s) return false
  }
  if (endDate) {
    const e = new Date(endDate + "T23:59:59.999").getTime()
    if (!Number.isNaN(e) && t > e) return false
  }
  return true
}

const esc = (v: any) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// GET → export Excel (.xls) des statistiques d'usage, avec les mêmes filtres
// que l'écran (startDate, endDate, userId). Généré sous forme de table HTML
// qu'Excel ouvre nativement (aucune dépendance serveur).
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const params = new URL(request.url).searchParams
    const startDate = params.get("startDate") || undefined
    const endDate = params.get("endDate") || undefined
    const userIdParam = params.get("userId") || ""
    const userId = userIdParam && userIdParam !== "all" ? Number(userIdParam) : null
    const bqParam = params.get("banqueId") || ""
    let bankIds: Set<number> | null = null
    let bankLabel = "Toutes"
    if (bqParam && bqParam !== "all" && !Number.isNaN(Number(bqParam))) {
      bankIds = await bankUserIds(Number(bqParam))
      const bank = await getBank(Number(bqParam))
      bankLabel = bank?.nom || `#${bqParam}`
    }

    let logs: any[] = []
    try { logs = JSON.parse(await fs.readFile(LOGS_FILE, "utf-8")) } catch { logs = [] }

    let allUsers: any[] = []
    try { allUsers = JSON.parse(await fs.readFile(USERS_FILE, "utf-8")) } catch { allUsers = [] }
    let allApps: any[] = []
    try { allApps = JSON.parse(await fs.readFile(APPLICATIONS_FILE, "utf-8")) } catch { allApps = [] }
    const banks = await listBanks()
    // Périmètre applis pour catégories + applis non utilisées (borné à la banque filtrée)
    let scopedApps = allApps
    if (bqParam && bqParam !== "all" && !Number.isNaN(Number(bqParam))) {
      const bk = await getBank(Number(bqParam))
      const allowed = new Set(bk?.app_ids || [])
      scopedApps = allApps.filter((a: any) => allowed.has(a.id))
    }

    let userLabel = "Tous"
    if (userId !== null) {
      userLabel = allUsers.find((u: any) => u.id === userId)?.nom || `#${userId}`
    }

    const opens = logs.filter(
      (l) =>
        l.action === "Ouverture application" &&
        inRange(l.timestamp, startDate, endDate) &&
        (userId === null || l.userId === userId) &&
        (bankIds === null || (typeof l.userId === "number" && bankIds.has(l.userId)))
    )

    const agg = aggregate(opens, allUsers, banks, scopedApps)
    const topApps = agg.topApps
    const topUsers = agg.topUsers
    const total = agg.totalOpens
    // Ventilation par banque : uniquement si aucun filtre banque n'est appliqué.
    const noBankFilter = bankIds === null
    const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1).replace(".", ",") + "%" : "0%")
    // Période datée : bornes des filtres, sinon dates réelles des données.
    let firstOpen: string | null = null, lastOpen: string | null = null
    for (const l of opens) {
      if (!firstOpen || l.timestamp < firstOpen) firstOpen = l.timestamp
      if (!lastOpen || l.timestamp > lastOpen) lastOpen = l.timestamp
    }
    const d = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "")
    const startLabel = startDate ? new Date(startDate).toLocaleDateString("fr-FR") : (d(firstOpen) || d(new Date().toISOString()))
    const endLabel = endDate ? new Date(endDate).toLocaleDateString("fr-FR") : (d(lastOpen) || d(new Date().toISOString()))
    const period = `${startLabel} → ${endLabel}`
    const now = new Date().toLocaleString("fr-FR")

    const th = 'style="background:#217346;color:#fff;font-weight:bold;border:1px solid #ccc;padding:4px 8px"'
    const hd = 'style="background:#d9ead3;font-weight:bold;border:1px solid #ccc;padding:4px 8px"'
    const td = 'style="border:1px solid #ccc;padding:4px 8px"'
    const tdr = 'style="border:1px solid #ccc;padding:4px 8px;text-align:right"'

    const appRows = topApps.map((a, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${esc(a.nom)}</td><td ${tdr}>${a.count}</td><td ${tdr}>${pct(a.count)}</td></tr>`).join("")

    // Sections « par banque » (uniquement sans filtre banque)
    let bankSections = ""
    if (noBankFilter) {
      // 1) Banques les plus actives
      const bankRankRows = agg.byBank
        .map((b, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${esc(b.nom)}</td><td ${tdr}>${b.count}</td><td ${tdr}>${pct(b.count)}</td></tr>`)
        .join("")
      bankSections += `
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Banques les plus actives</td></tr>
<tr><td ${hd}>Rang</td><td ${hd}>Banque</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${bankRankRows || `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}`

      // 2) Détail par banque : applications les plus ouvertes + utilisateurs classés
      for (const bd of agg.bankDetails) {
        const bAppRows = bd.topApps
          .map((a, i) => `<tr><td ${td}>${i + 1}</td><td ${td} colspan="2">${esc(a.nom)}</td><td ${tdr}>${a.count}</td></tr>`)
          .join("")
        const bUserRows = bd.users
          .map((u, i) => `<tr><td ${td}>${i + 1}</td><td ${td} colspan="2">${esc(u.nom)}</td><td ${tdr}>${u.count}</td></tr>`)
          .join("")
        bankSections += `
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Banque : ${esc(bd.nom)} — ${bd.count} ouverture(s)</td></tr>
<tr><td ${hd}>Rang</td><td ${hd} colspan="2">Application la plus ouverte</td><td ${hd}>Ouvertures</td></tr>
${bAppRows || `<tr><td ${td} colspan="4">Aucune ouverture</td></tr>`}
<tr><td ${hd}>Rang</td><td ${hd} colspan="2">Utilisateur (du plus actif au moins actif)</td><td ${hd}>Ouvertures</td></tr>
${bUserRows || `<tr><td ${td} colspan="4">Aucun utilisateur</td></tr>`}`
      }
    }

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table>
<tr><td colspan="4" style="font-size:16px;font-weight:bold;color:#217346">Monétique Tunisie — Statistiques d'usage</td></tr>
<tr><td colspan="4">Banque : ${esc(bankLabel)} | Période : ${esc(period)} | Utilisateur : ${esc(userLabel)}</td></tr>
<tr><td colspan="4">Généré le ${esc(now)} — Total d'ouvertures : ${total} — Banques actives : ${agg.activeBanks}</td></tr>
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Applications les plus ouvertes (global)</td></tr>
<tr><td ${hd}>Rang</td><td ${hd}>Application</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${appRows || `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}
<tr><td ${hd} colspan="2">Total</td><td ${tdr} style="font-weight:bold">${total}</td><td ${tdr} style="font-weight:bold">${total ? "100%" : "0%"}</td></tr>
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Utilisateurs les plus actifs (global)</td></tr>
<tr><td ${hd}>Rang</td><td ${hd} colspan="2">Utilisateur</td><td ${hd}>Ouvertures</td></tr>
${topUsers.length ? topUsers.map((u, i) => `<tr><td ${td}>${i + 1}</td><td ${td} colspan="2">${esc(u.nom)}</td><td ${tdr}>${u.count}</td></tr>`).join("") : `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Ouvertures par catégorie</td></tr>
<tr><td ${hd} colspan="2">Catégorie</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${agg.byCategory.length ? agg.byCategory.map((c) => `<tr><td ${td} colspan="2">${esc(c.category)}</td><td ${tdr}>${c.count}</td><td ${tdr}>${pct(c.count)}</td></tr>`).join("") : `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Applications jamais utilisées sur la période</td></tr>
${agg.appUsage.filter((a) => a.count === 0).length ? agg.appUsage.filter((a) => a.count === 0).map((a) => `<tr><td ${td} colspan="4">${esc(a.nom)} (${esc(a.category)})</td></tr>`).join("") : `<tr><td ${td} colspan="4">Aucune (toutes les applications ont été ouvertes)</td></tr>`}
${bankSections}
</table></body></html>`

    return new NextResponse("﻿" + html, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="statistiques-usage.xls"`,
      },
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
