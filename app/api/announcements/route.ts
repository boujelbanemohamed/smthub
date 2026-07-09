import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser, requireAdmin, authErrorResponse } from "@/lib/auth"
import { listAnnouncements, addAnnouncement, updateAnnouncement, deleteAnnouncement, toggleAnnouncement, isAnnouncementVisible, isAnnouncementForUser } from "@/lib/announcements-store"
import { listGroups } from "@/lib/groups-store"
import { getDismissedIdsForUser } from "@/lib/announcement-dismissals-store"
import { logAction } from "@/lib/logger"

// GET → annonces. Utilisateur standard : uniquement les annonces actives.
// Admin (?all=1) : toutes les annonces pour l'administration.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const all = new URL(request.url).searchParams.get("all") === "1"
    const items = await listAnnouncements()
    if (all && user.role === "admin") {
      return NextResponse.json({ announcements: items })
    }
    // Utilisateur standard : uniquement les annonces réellement visibles maintenant
    // (actives ET dans leur fenêtre de dates) ET qui le ciblent (tout le monde,
    // son groupe, ou lui personnellement).
    const groups = await listGroups()
    const groupMembers = (gid?: string | null) => groups.find((g) => g.id === gid)?.member_ids || []
    const dismissed = await getDismissedIdsForUser(user.id)
    return NextResponse.json({
      announcements: items.filter(
        (a) =>
          isAnnouncementVisible(a) &&
          isAnnouncementForUser(a, user.id, groupMembers(a.group_id)) &&
          // Annonce fermable déjà fermée par cet utilisateur → on ne la réaffiche plus.
          !(a.dismissible !== false && dismissed.has(a.id))
      ),
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { message, level } → crée une annonce (admin)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { message, level, start_date, end_date, audience, group_id, user_ids, dismissible } = await request.json()
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message requis" }, { status: 400 })
    }
    const lvl = ["info", "warning", "success"].includes(level) ? level : "info"
    const aud = ["all", "group", "users"].includes(audience) ? audience : "all"
    if (aud === "group" && !group_id) {
      return NextResponse.json({ error: "Veuillez choisir un groupe" }, { status: 400 })
    }
    if (aud === "users" && (!Array.isArray(user_ids) || user_ids.length === 0)) {
      return NextResponse.json({ error: "Veuillez choisir au moins un utilisateur" }, { status: 400 })
    }
    // Validation légère des dates : si fournies, elles doivent être parsables
    // et la fin doit être postérieure au début.
    const start = start_date ? new Date(start_date) : null
    const end = end_date ? new Date(end_date) : null
    if (start && isNaN(start.getTime())) return NextResponse.json({ error: "Date de début invalide" }, { status: 400 })
    if (end && isNaN(end.getTime())) return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 })
    if (start && end && end.getTime() < start.getTime()) {
      return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 })
    }
    const item = await addAnnouncement(
      message.trim(),
      lvl,
      admin.nom,
      start ? start.toISOString() : null,
      end ? end.toISOString() : null,
      aud,
      group_id,
      Array.isArray(user_ids) ? user_ids.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n)) : [],
      dismissible !== false
    )
    await logAction("Création annonce", `Annonce publiée: ${message.trim().slice(0, 80)}`, "INFO", admin.id, admin.nom)
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PATCH { id } → active/désactive une annonce (admin)
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const { id } = await request.json()
    const item = await toggleAnnouncement(id)
    if (!item) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT { id, message, level, start_date, end_date, audience, group_id, user_ids, dismissible }
// → modifie une annonce existante (admin)
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { id, message, level, start_date, end_date, audience, group_id, user_ids, dismissible } = await request.json()
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message requis" }, { status: 400 })
    }
    const aud = ["all", "group", "users"].includes(audience) ? audience : "all"
    if (aud === "group" && !group_id) {
      return NextResponse.json({ error: "Veuillez choisir un groupe" }, { status: 400 })
    }
    if (aud === "users" && (!Array.isArray(user_ids) || user_ids.length === 0)) {
      return NextResponse.json({ error: "Veuillez choisir au moins un utilisateur" }, { status: 400 })
    }
    const start = start_date ? new Date(start_date) : null
    const end = end_date ? new Date(end_date) : null
    if (start && isNaN(start.getTime())) return NextResponse.json({ error: "Date de début invalide" }, { status: 400 })
    if (end && isNaN(end.getTime())) return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 })
    if (start && end && end.getTime() < start.getTime()) {
      return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 })
    }

    const item = await updateAnnouncement(id, {
      message: message.trim(),
      level: ["info", "warning", "success"].includes(level) ? level : "info",
      start_date: start ? start.toISOString() : null,
      end_date: end ? end.toISOString() : null,
      audience: aud,
      group_id,
      user_ids: Array.isArray(user_ids) ? user_ids.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n)) : [],
      dismissible: dismissible !== false,
    })
    if (!item) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 })
    await logAction("Modification annonce", `Annonce modifiée: ${message.trim().slice(0, 80)}`, "INFO", admin.id, admin.nom)
    return NextResponse.json(item)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE ?id=... → supprime une annonce (admin)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const id = new URL(request.url).searchParams.get("id") || ""
    const ok = await deleteAnnouncement(id)
    if (!ok) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 })
    await logAction("Suppression annonce", `Annonce supprimée (${id})`, "INFO", admin.id, admin.nom)
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
