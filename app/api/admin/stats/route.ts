import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { bankUserIds } from "@/lib/banks-store"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")

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
    // Cloisonnement : un admin de banque ne voit que les stats de sa banque.
    const bankIds = isBankAdmin(me) ? await bankUserIds(me.banque_id!) : null
    const params = new URL(request.url).searchParams
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

    const byApp = new Map<string, { appId: number; nom: string; count: number }>()
    const byUser = new Map<number, { userId: number; nom: string; count: number }>()

    for (const l of opens) {
      const appId = l.metadata?.appId ?? -1
      const appName = l.metadata?.appName ?? `Application ${appId}`
      const keyApp = String(appId)
      const a = byApp.get(keyApp) || { appId, nom: appName, count: 0 }
      a.count++
      a.nom = appName
      byApp.set(keyApp, a)

      if (typeof l.userId === "number") {
        const u = byUser.get(l.userId) || { userId: l.userId, nom: l.userName || `Utilisateur ${l.userId}`, count: 0 }
        u.count++
        u.nom = l.userName || u.nom
        byUser.set(l.userId, u)
      }
    }

    const topApps = Array.from(byApp.values()).sort((a, b) => b.count - a.count)
    const topUsers = Array.from(byUser.values()).sort((a, b) => b.count - a.count)

    // Bornes réelles des données (pour afficher une période datée, sans « aujourd'hui »)
    let firstOpen: string | null = null
    let lastOpen: string | null = null
    for (const l of opens) {
      if (!firstOpen || l.timestamp < firstOpen) firstOpen = l.timestamp
      if (!lastOpen || l.timestamp > lastOpen) lastOpen = l.timestamp
    }

    return NextResponse.json({
      totalOpens: opens.length,
      topApps,
      topUsers,
      firstOpen,
      lastOpen,
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
