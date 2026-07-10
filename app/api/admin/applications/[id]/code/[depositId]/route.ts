import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { deleteDeposit } from "@/lib/app-code-store"
import { logApplicationAction } from "@/lib/logger"

// DELETE → supprime un dépôt de code (admin)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; depositId: string } }) {
  try {
    const admin = await requireAdmin()
    const appId = parseInt(params.id)
    if (Number.isNaN(appId)) return NextResponse.json({ error: "Application invalide" }, { status: 400 })
    const ok = await deleteDeposit(appId, params.depositId)
    if (!ok) return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 })
    await logApplicationAction("Suppression code application", appId, "", admin.id, admin.nom, `Dépôt de code supprimé (${params.depositId})`)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
