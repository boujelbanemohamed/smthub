import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { deleteDeposit } from "@/lib/app-code-store"
import { logApplicationAction } from "@/lib/logger"

// DELETE → supprime un dépôt de code (admin).
// Exige une reconfirmation du mot de passe de l'administrateur connecté.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; depositId: string }> }) {
  try {
    const admin = await requireSuperAdmin()
    const appId = parseInt((await params).id)
    if (Number.isNaN(appId)) return NextResponse.json({ error: "Application invalide" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    if (!(await verifyCurrentUserPassword(body?.password))) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
    }

    const ok = await deleteDeposit(appId, (await params).depositId)
    if (!ok) return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 })
    await logApplicationAction("Suppression code application", appId, "", admin.id, admin.nom, `Dépôt de code supprimé (${(await params).depositId})`)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
