import { type NextRequest, NextResponse } from "next/server"
import { getLogs, cleanOldLogs, deleteLogsByIds, clearAllLogs } from "@/lib/logger"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const { searchParams } = new URL(request.url)
    
    // Paramètres de filtrage
    const level = searchParams.get("level") as any
    const action = searchParams.get("action") ?? undefined
    const userId = searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : undefined
    const status = searchParams.get("status") as any
    const startDate = searchParams.get("startDate") ?? undefined
    const endDate = searchParams.get("endDate") ?? undefined
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0

    // On ne passe PAS `limit` à getLogs : sinon la liste serait tronquée avant
    // la pagination et les pages suivantes seraient vides. On récupère tout le
    // filtré, puis on pagine ici (offset/limit).
    const filters = {
      level,
      action,
      userId,
      status,
      startDate,
      endDate,
    }

    const allLogs = await getLogs(filters)
    const total = allLogs.length
    const logs = allLogs.slice(offset, offset + limit)
    
    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      filters
    })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error("Erreur lors de la récupération des logs:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE : trois modes selon les paramètres/le corps de la requête.
//  - ?all=1              → purge l'intégralité du journal
//  - corps { ids: [...] } → supprime les lignes indiquées
//  - ?daysToKeep=N       → nettoie les entrées de plus de N jours (compat.)
export async function DELETE(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const { searchParams } = new URL(request.url)

    if (searchParams.get("all") === "1") {
      const deleted = await clearAllLogs()
      return NextResponse.json({ success: true, deleted, message: `Journal vidé (${deleted} entrée(s) supprimée(s)).` })
    }

    // Suppression de lignes ciblées via le corps JSON
    let ids: string[] = []
    try {
      const body = await request.json()
      if (Array.isArray(body?.ids)) ids = body.ids.map((x: any) => String(x))
    } catch {
      /* pas de corps JSON */
    }
    if (ids.length > 0) {
      const deleted = await deleteLogsByIds(ids)
      return NextResponse.json({ success: true, deleted, message: `${deleted} ligne(s) supprimée(s).` })
    }

    const daysToKeep = searchParams.get("daysToKeep") ? parseInt(searchParams.get("daysToKeep")!) : 30
    await cleanOldLogs(daysToKeep)
    return NextResponse.json({
      success: true,
      message: `Logs nettoyés. Conservation des ${daysToKeep} derniers jours.`,
    })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error("Erreur lors du nettoyage des logs:", error)
    return NextResponse.json({ error: "Erreur lors du nettoyage" }, { status: 500 })
  }
} 