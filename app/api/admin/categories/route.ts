import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { listCategories, addCategory } from "@/lib/categories-store"
import { logAction } from "@/lib/logger"

// GET → liste des catégories (admin)
export async function GET() {
  try {
    await requireAdmin()
    const items = await listCategories()
    return NextResponse.json(items)
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { name } → ajoute une catégorie (admin)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { name } = await request.json()
    const result = await addCategory(typeof name === "string" ? name : "")
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    await logAction("Création catégorie", `Catégorie créée: ${result.name}`, "INFO", admin.id, admin.nom)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
