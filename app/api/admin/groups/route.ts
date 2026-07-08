import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, authErrorResponse } from "@/lib/auth"
import { listGroups, addGroup, updateGroup, deleteGroup } from "@/lib/groups-store"
import { logAction } from "@/lib/logger"

// GET → liste des groupes d'utilisateurs
export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json({ groups: await listGroups() })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { nom, member_ids } → crée un groupe
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { nom, member_ids } = await request.json()
    if (typeof nom !== "string" || !nom.trim()) {
      return NextResponse.json({ error: "Nom du groupe requis" }, { status: 400 })
    }
    const group = await addGroup(nom, member_ids)
    await logAction("Création groupe", `Groupe créé: ${group.nom} (${group.member_ids.length} membre(s))`, "INFO", admin.id, admin.nom)
    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PATCH { id, nom?, member_ids? } → met à jour un groupe
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { id, nom, member_ids } = await request.json()
    const group = await updateGroup(id, { nom, member_ids })
    if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 })
    await logAction("Mise à jour groupe", `Groupe modifié: ${group.nom} (${group.member_ids.length} membre(s))`, "INFO", admin.id, admin.nom)
    return NextResponse.json(group)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE ?id=... → supprime un groupe (n'affecte pas les accès déjà accordés)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const id = new URL(request.url).searchParams.get("id") || ""
    const ok = await deleteGroup(id)
    if (!ok) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 })
    await logAction("Suppression groupe", `Groupe supprimé (${id})`, "INFO", admin.id, admin.nom)
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
