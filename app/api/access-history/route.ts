import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, requireSuperAdmin, getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  type AccessHistoryEntry,
  usePostgres,
  readAccessHistory,
  writeAccessHistory,
  logAccessChange
} from "@/lib/access-history"

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    const appId = searchParams.get("app_id")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const usePg = usePostgres()
    let history: AccessHistoryEntry[] = []
    if (usePg) {
      const where: any = {}
      if (userId) where.utilisateur_id = parseInt(userId)
      if (appId) where.application_id = parseInt(appId)
      const total = await prisma.accessHistory.count({ where })
      const rows = await prisma.accessHistory.findMany({
        where,
        orderBy: { performed_at: "desc" },
        skip: offset,
        take: limit
      })
      const mapped = rows.map((r: any) => ({
        id: r.id,
        utilisateur_id: r.utilisateur_id,
        application_id: r.application_id,
        action: r.action as any,
        old_level: r.old_level || undefined,
        new_level: r.new_level || undefined,
        performed_by: r.performed_by,
        performed_at: r.performed_at.toISOString(),
        ip_address: r.ip_address || undefined,
        user_agent: r.user_agent || undefined
      }))
      return NextResponse.json({
        history: mapped,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      })
    }

    history = await readAccessHistory()
    
    // Filter by user if specified
    if (userId) {
      history = history.filter(entry => entry.utilisateur_id === parseInt(userId))
    }
    
    // Filter by application if specified
    if (appId) {
      history = history.filter(entry => entry.application_id === parseInt(appId))
    }
    
    // Apply pagination
    const total = history.length
    const paginatedHistory = history.slice(offset, offset + limit)
    
    return NextResponse.json({
      history: paginatedHistory,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentUser()
    if (!admin) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    
    const { utilisateur_id, application_id, action, old_level, new_level } = await request.json()
    
    // Validation
    if (!utilisateur_id || !application_id || !action) {
      return NextResponse.json({ 
        error: "Les champs utilisateur_id, application_id et action sont requis" 
      }, { status: 400 })
    }
    
    const validActions = ["granted", "revoked", "modified"]
    if (!validActions.includes(action)) {
      return NextResponse.json({ 
        error: "Action invalide. Valeurs autorisées: granted, revoked, modified" 
      }, { status: 400 })
    }
    
    await logAccessChange(
      utilisateur_id,
      application_id,
      action,
      admin.id,
      old_level,
      new_level,
      request
    )
    
    return NextResponse.json({ 
      success: true, 
      message: "Entrée d'historique ajoutée avec succès" 
    })
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'entrée d'historique:", error)
    return NextResponse.json({ error: "Erreur lors de l'ajout" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSuperAdmin()
    
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("older_than_days") || "0")
    
    if (days <= 0) {
      return NextResponse.json({ 
        error: "Le paramètre older_than_days doit être un nombre positif" 
      }, { status: 400 })
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    if (usePostgres()) {
      const res = await prisma.accessHistory.deleteMany({
        where: { performed_at: { lte: cutoffDate } }
      })
      return NextResponse.json({
        success: true,
        message: `${res.count} entrées supprimées`,
        deleted_count: res.count
      })
    } else {
      const history = await readAccessHistory()
      const filteredHistory = history.filter(entry => 
        new Date(entry.performed_at) > cutoffDate
      )
      await writeAccessHistory(filteredHistory)
      const deletedCount = history.length - filteredHistory.length
      return NextResponse.json({ 
        success: true, 
        message: `${deletedCount} entrées supprimées`,
        deleted_count: deletedCount,
        remaining_count: filteredHistory.length
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    console.error("Erreur lors de la suppression de l'historique:", error)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
