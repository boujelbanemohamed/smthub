import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { renameCategory, deleteCategory } from "@/lib/categories-store"
import { logAction } from "@/lib/logger"

// PUT { name } → renomme une catégorie (admin). Le nouveau nom est répercuté
// sur les applications qui l'utilisaient.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    const { name } = await request.json()
    const result = await renameCategory(params.id, typeof name === "string" ? name : "")
    if ("error" in result) {
      const status = result.error === "Catégorie introuvable" ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    await logAction("Modification catégorie", `Catégorie renommée: ${result.name}`, "INFO", admin.id, admin.nom)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE → supprime une catégorie (admin). Les applications concernées sont
// remises à « sans catégorie ».
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    const result = await deleteCategory(params.id)
    if (!result.ok) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 })
    await logAction("Suppression catégorie", `Catégorie supprimée (${params.id})`, "INFO", admin.id, admin.nom)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
