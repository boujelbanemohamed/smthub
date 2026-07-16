import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { updateBank, deleteBank } from "@/lib/banks-store"
import { logAction } from "@/lib/logger"

// PUT { nom?, app_ids?, actif? } → modifie une banque (super-admin).
// Passer actif:false applique la cascade (désactive/détache les utilisateurs).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin()
    const id = parseInt((await params).id)
    if (Number.isNaN(id)) return NextResponse.json({ error: "Banque invalide" }, { status: 400 })
    const body = await request.json().catch(() => ({}))
    const result = await updateBank(id, {
      nom: typeof body.nom === "string" ? body.nom : undefined,
      app_ids: Array.isArray(body.app_ids) ? body.app_ids : undefined,
      actif: typeof body.actif === "boolean" ? body.actif : undefined,
      logo_url: body.logo_url !== undefined ? body.logo_url : undefined,
      theme_color: body.theme_color !== undefined ? body.theme_color : undefined,
    })
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.error === "Banque introuvable" ? 404 : 400 })
    }
    await logAction("Modification banque", `Banque modifiée: ${result.nom} (${result.actif ? "active" : "désactivée"})`, "INFO", admin.id, admin.nom)
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE → supprime une banque (super-admin), avec cascade sur les utilisateurs.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin()
    const id = parseInt((await params).id)
    if (Number.isNaN(id)) return NextResponse.json({ error: "Banque invalide" }, { status: 400 })
    const ok = await deleteBank(id)
    if (!ok) return NextResponse.json({ error: "Banque introuvable" }, { status: 404 })
    await logAction("Suppression banque", `Banque supprimée (${id})`, "WARNING", admin.id, admin.nom)
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
