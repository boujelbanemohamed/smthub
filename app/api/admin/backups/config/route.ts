import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getBackupConfig, saveBackupConfig, sanitizeConfig } from "@/lib/backup-config"
import { logAction } from "@/lib/logger"

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")
}

// GET → configuration de la sauvegarde automatique (admin)
export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json(await getBackupConfig())
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT → met à jour la planification (admin)
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json().catch(() => ({}))
    const previous = await getBackupConfig()
    const next = sanitizeConfig(body, previous)
    next.updatedBy = admin.nom
    next.updatedAt = new Date().toISOString()
    await saveBackupConfig(next)
    await logAction(
      "Configuration sauvegarde",
      `Planification ${next.enabled ? "activée" : "désactivée"} (${next.frequency}, ${next.hour}h, rétention ${next.retentionDays} j)`,
      "INFO",
      admin.id,
      admin.nom
    )
    return NextResponse.json(next)
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
