import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, getCurrentUser } from "@/lib/auth"

const ACCESS_HISTORY_FILE = path.join(process.cwd(), "data", "access-history.json")

export interface AccessHistoryEntry {
  id: string
  utilisateur_id: number
  application_id: number
  action: "granted" | "revoked" | "modified"
  old_level?: string
  new_level?: string
  performed_by: number // ID de l'admin qui a effectué l'action
  performed_at: string
  ip_address?: string
  user_agent?: string
}

async function readAccessHistory(): Promise<AccessHistoryEntry[]> {
  try {
    const data = await fs.readFile(ACCESS_HISTORY_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeAccessHistory(history: AccessHistoryEntry[]) {
  const dataDir = path.dirname(ACCESS_HISTORY_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(ACCESS_HISTORY_FILE, JSON.stringify(history, null, 2))
}

export async function logAccessChange(
  userId: number,
  appId: number,
  action: "granted" | "revoked" | "modified",
  performedBy: number,
  oldLevel?: string,
  newLevel?: string,
  request?: NextRequest
): Promise<void> {
  try {
    const history = await readAccessHistory()
    
    const entry: AccessHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      utilisateur_id: userId,
      application_id: appId,
      action,
      old_level: oldLevel,
      new_level: newLevel,
      performed_by: performedBy,
      performed_at: new Date().toISOString(),
      ip_address: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
      user_agent: request?.headers.get("user-agent") || "unknown"
    }
    
    history.unshift(entry) // Add to beginning for chronological order
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (history.length > 1000) {
      history.splice(1000)
    }
    
    await writeAccessHistory(history)
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'historique d'accès:", error)
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    const appId = searchParams.get("app_id")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    
    let history = await readAccessHistory()
    
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
    await requireAdmin()
    
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("older_than_days") || "0")
    
    if (days <= 0) {
      return NextResponse.json({ 
        error: "Le paramètre older_than_days doit être un nombre positif" 
      }, { status: 400 })
    }
    
    const history = await readAccessHistory()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
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
