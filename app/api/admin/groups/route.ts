import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { listGroups, addGroup, updateGroup, deleteGroup } from "@/lib/groups-store"
import { bankUserIds } from "@/lib/banks-store"
import { logAction } from "@/lib/logger"

// GET → liste des groupes. Cloisonnement : un admin de banque ne voit que les
// groupes de sa banque.
export async function GET() {
  try {
    const me = await requireAdmin()
    let groups = await listGroups()
    if (isBankAdmin(me)) {
      groups = groups.filter((g) => (g.banque_id ?? null) === me.banque_id)
    }
    return NextResponse.json({ groups })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { nom, member_ids } → crée un groupe. Un admin de banque le rattache
// forcément à sa banque, et ne peut y mettre que des utilisateurs de sa banque.
export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin()
    const { nom, member_ids } = await request.json()
    if (typeof nom !== "string" || !nom.trim()) {
      return NextResponse.json({ error: "Nom du groupe requis" }, { status: 400 })
    }
    let banqueId: number | null = null
    let members = Array.isArray(member_ids) ? member_ids : []
    if (isBankAdmin(me)) {
      banqueId = me.banque_id!
      const ids = await bankUserIds(banqueId)
      members = members.filter((m: any) => ids.has(Number(m)))
    }
    const group = await addGroup(nom, members, banqueId)
    await logAction("Création groupe", `Groupe créé: ${group.nom} (${group.member_ids.length} membre(s))`, "INFO", me.id, me.nom)
    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PATCH { id, nom?, member_ids? } → met à jour un groupe.
export async function PATCH(request: NextRequest) {
  try {
    const me = await requireAdmin()
    const { id, nom, member_ids } = await request.json()
    const all = await listGroups()
    const existing = all.find((g) => g.id === id)
    if (!existing) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 })
    // Cloisonnement : un admin de banque ne modifie que ses groupes, et n'y met
    // que des utilisateurs de sa banque.
    let members = member_ids
    if (isBankAdmin(me)) {
      if ((existing.banque_id ?? null) !== me.banque_id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
      }
      if (Array.isArray(member_ids)) {
        const ids = await bankUserIds(me.banque_id!)
        members = member_ids.filter((m: any) => ids.has(Number(m)))
      }
    }
    const group = await updateGroup(id, { nom, member_ids: members })
    if (!group) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 })
    await logAction("Mise à jour groupe", `Groupe modifié: ${group.nom} (${group.member_ids.length} membre(s))`, "INFO", me.id, me.nom)
    return NextResponse.json(group)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE ?id=... → supprime un groupe (n'affecte pas les accès déjà accordés)
export async function DELETE(request: NextRequest) {
  try {
    const me = await requireAdmin()
    const id = new URL(request.url).searchParams.get("id") || ""
    if (isBankAdmin(me)) {
      const all = await listGroups()
      const existing = all.find((g) => g.id === id)
      if (existing && (existing.banque_id ?? null) !== me.banque_id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
      }
    }
    const ok = await deleteGroup(id)
    if (!ok) return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 })
    await logAction("Suppression groupe", `Groupe supprimé (${id})`, "INFO", me.id, me.nom)
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
