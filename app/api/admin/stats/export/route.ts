import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { bankUserIds } from "@/lib/banks-store"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")

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
    if (bqParam && bqParam !== "all" && !Number.isNaN(Number(bqParam))) {
      bankIds = await bankUserIds(Number(bqParam))
    }

    let logs: any[] = []
    try { logs = JSON.parse(await fs.readFile(LOGS_FILE, "utf-8")) } catch { logs = [] }

    let userLabel = "Tous"
    if (userId !== null) {
      try {
        const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
        userLabel = users.find((u: any) => u.id === userId)?.nom || `#${userId}`
      } catch { userLabel = `#${userId}` }
    }

    const opens = logs.filter(
      (l) =>
        l.action === "Ouverture application" &&
        inRange(l.timestamp, startDate, endDate) &&
        (userId === null || l.userId === userId) &&
        (bankIds === null || (typeof l.userId === "number" && bankIds.has(l.userId)))
    )

    const byApp = new Map<string, { nom: string; count: number }>()
    const byUser = new Map<number, { nom: string; count: number }>()
    for (const l of opens) {
      const nom = l.metadata?.appName ?? `Application ${l.metadata?.appId ?? "?"}`
      const a = byApp.get(nom) || { nom, count: 0 }; a.count++; byApp.set(nom, a)
      if (typeof l.userId === "number") {
        const u = byUser.get(l.userId) || { nom: l.userName || `Utilisateur ${l.userId}`, count: 0 }
        u.count++; u.nom = l.userName || u.nom; byUser.set(l.userId, u)
      }
    }
    const topApps = Array.from(byApp.values()).sort((a, b) => b.count - a.count)
    const topUsers = Array.from(byUser.values()).sort((a, b) => b.count - a.count)
    const total = opens.length
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
    const userRows = topUsers.map((u, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${esc(u.nom)}</td><td ${tdr}>${u.count}</td></tr>`).join("")

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table>
<tr><td colspan="4" style="font-size:16px;font-weight:bold;color:#217346">Monétique Tunisie — Statistiques d'usage</td></tr>
<tr><td colspan="4">Période : ${esc(period)} | Utilisateur : ${esc(userLabel)}</td></tr>
<tr><td colspan="4">Généré le ${esc(now)} — Total d'ouvertures : ${total}</td></tr>
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Applications les plus ouvertes</td></tr>
<tr><td ${hd}>Rang</td><td ${hd}>Application</td><td ${hd}>Ouvertures</td><td ${hd}>Part (%)</td></tr>
${appRows || `<tr><td ${td} colspan="4">Aucune donnée</td></tr>`}
<tr><td ${hd} colspan="2">Total</td><td ${tdr} style="font-weight:bold">${total}</td><td ${tdr} style="font-weight:bold">${total ? "100%" : "0%"}</td></tr>
<tr><td colspan="4"></td></tr>
<tr><td colspan="4" ${th}>Utilisateurs les plus actifs</td></tr>
<tr><td ${hd}>Rang</td><td ${hd}>Utilisateur</td><td ${hd}>Ouvertures</td></tr>
${userRows || `<tr><td ${td} colspan="3">Aucune donnée</td></tr>`}
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
