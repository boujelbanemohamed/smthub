import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { listBackups, createBackup } from "@/lib/backup-store"
import { logAction, logError } from "@/lib/logger"

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")
}

// GET → liste des sauvegardes disponibles (admin)
export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json(await listBackups())
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { password } → crée une sauvegarde à la demande (admin, mot de passe requis)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json().catch(() => ({}))
    if (!(await verifyCurrentUserPassword(body?.password))) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
    }
    const info = await createBackup()
    await logAction("Création sauvegarde", `Sauvegarde créée: ${info.name} (${Math.round(info.size / 1024)} Ko)`, "INFO", admin.id, admin.nom)
    return NextResponse.json(info, { status: 201 })
  } catch (error) {
    await logError("Création sauvegarde", "Erreur lors de la création d'une sauvegarde", error instanceof Error ? error.message : "Erreur inconnue")
    if (unauthorized(error)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
