import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { resolveBackup, restoreFromArchive } from "@/lib/backup-store"
import { logAction, logError } from "@/lib/logger"

// POST { password } → restaure une sauvegarde existante (admin, mot de passe
// requis). ⚠️ Remplace les données actuelles, après une copie de sécurité.
export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const admin = await requireAdmin()
    const body = await request.json().catch(() => ({}))
    if (!(await verifyCurrentUserPassword(body?.password))) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
    }

    const name = decodeURIComponent((await params).name)
    const abs = await resolveBackup(name)
    if (!abs) return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 })

    const { safety } = await restoreFromArchive(abs, name.endsWith(".tar.gz"))
    await logAction("Restauration sauvegarde", `Sauvegarde restaurée: ${name}`, "WARNING", admin.id, admin.nom)
    return NextResponse.json({ success: true, message: "Restauration effectuée.", safety })
  } catch (error) {
    await logError("Restauration sauvegarde", "Erreur lors de la restauration", error instanceof Error ? error.message : "Erreur inconnue")
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la restauration" }, { status: 500 })
  }
}
