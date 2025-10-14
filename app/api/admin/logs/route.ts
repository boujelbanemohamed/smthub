import { type NextRequest, NextResponse } from "next/server"
import { getLogs, cleanOldLogs } from "@/lib/logger"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    
    // Paramètres de filtrage
    const level = searchParams.get("level") as any
    const action = searchParams.get("action")
    const userId = searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : undefined
    const status = searchParams.get("status") as any
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100

    const filters = {
      level,
      action,
      userId,
      status,
      startDate,
      endDate,
      limit
    }

    const logs = await getLogs(filters)
    
    return NextResponse.json({
      logs,
      total: logs.length,
      filters
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des logs:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const daysToKeep = searchParams.get("daysToKeep") ? parseInt(searchParams.get("daysToKeep")!) : 30

    await cleanOldLogs(daysToKeep)
    
    return NextResponse.json({ 
      success: true, 
      message: `Logs nettoyés. Conservation des ${daysToKeep} derniers jours.` 
    })
  } catch (error) {
    console.error("Erreur lors du nettoyage des logs:", error)
    return NextResponse.json({ error: "Erreur lors du nettoyage" }, { status: 500 })
  }
} 