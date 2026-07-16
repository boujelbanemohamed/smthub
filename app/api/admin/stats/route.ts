import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { bankUserIds, listBanks, getBank } from "@/lib/banks-store"
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

// GET → statistiques d'usage agrégées à partir du journal :
//  - total d'ouvertures d'applications
//  - top applications (les plus ouvertes)
//  - top utilisateurs (les plus actifs)
// Filtres facultatifs : ?startDate, ?endDate, ?userId
export async function GET(request: NextRequest) {
  try {
    const me = await requireAdmin()
    const params = new URL(request.url).searchParams
    // Cloisonnement : un admin de banque ne voit que les stats de sa banque.
    // Le super-admin peut, lui, filtrer volontairement par banque via ?banqueId=.
    let bankIds: Set<number> | null = null
    if (isBankAdmin(me)) {
      bankIds = await bankUserIds(me.banque_id!)
    } else {
      const bq = params.get("banqueId")
      if (bq && bq !== "all" && !Number.isNaN(Number(bq))) {
        bankIds = await bankUserIds(Number(bq))
      }
    }
    const startDate = params.get("startDate") || undefined
    const endDate = params.get("endDate") || undefined
    const userIdParam = params.get("userId") || ""
    const userId = userIdParam && userIdParam !== "all" ? Number(userIdParam) : null

    let logs: any[] = []
    try {
      logs = JSON.parse(await fs.readFile(LOGS_FILE, "utf-8"))
    } catch {
      logs = []
    }

    const opens = logs.filter(
      (l) =>
        l.action === "Ouverture application" &&
        inRange(l.timestamp, startDate, endDate) &&
        (userId === null || l.userId === userId) &&
        (bankIds === null || (typeof l.userId === "number" && bankIds.has(l.userId)))
    )

    let users: any[] = []
    try {
      users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
    } catch {
      users = []
    }
    let allApps: any[] = []
    try {
      allApps = JSON.parse(await fs.readFile(APPLICATIONS_FILE, "utf-8"))
    } catch {
      allApps = []
    }
    const banks = await listBanks()

    // Périmètre des applications (pour catégories + applis peu utilisées) :
    // borné à la banque quand un filtre banque est actif ou pour un admin de banque.
    let scopeBankId: number | null = null
    if (isBankAdmin(me)) scopeBankId = me.banque_id!
    else {
      const bq = params.get("banqueId")
      if (bq && bq !== "all" && !Number.isNaN(Number(bq))) scopeBankId = Number(bq)
    }
    let scopedApps = allApps
    if (scopeBankId != null) {
      const bank = await getBank(scopeBankId)
      const allowed = new Set(bank?.app_ids || [])
      scopedApps = allApps.filter((a: any) => allowed.has(a.id))
    }

    const agg = aggregate(opens, users, banks, scopedApps)

    // La ventilation par banque n'a de sens que sans filtre banque : on ne
    // l'expose (byBank / bankDetails) que dans ce cas (utilisée par l'export PDF).
    const noBankFilter = bankIds === null && !isBankAdmin(me)

    return NextResponse.json({
      totalOpens: agg.totalOpens,
      topApps: agg.topApps,
      topUsers: agg.topUsers,
      firstOpen: agg.firstOpen,
      lastOpen: agg.lastOpen,
      activeBanks: agg.activeBanks,
      byBank: noBankFilter ? agg.byBank : null,
      bankDetails: noBankFilter ? agg.bankDetails : null,
      timeline: agg.timeline,
      byHour: agg.byHour,
      byCategory: agg.byCategory,
      appUsage: agg.appUsage,
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
