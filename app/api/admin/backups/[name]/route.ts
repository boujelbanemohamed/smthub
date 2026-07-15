import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { deleteBackup } from "@/lib/backup-store"
import { logAction } from "@/lib/logger"

// DELETE { password } → supprime une sauvegarde (admin, mot de passe requis)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const admin = await requireSuperAdmin()
    const body = await request.json().catch(() => ({}))
    if (!(await verifyCurrentUserPassword(body?.password))) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
    }
    const name = decodeURIComponent((await params).name)
    const ok = await deleteBackup(name)
    if (!ok) return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 })
    await logAction("Suppression sauvegarde", `Sauvegarde supprimée: ${name}`, "INFO", admin.id, admin.nom)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
