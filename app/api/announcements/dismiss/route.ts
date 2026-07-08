import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { listAnnouncements } from "@/lib/announcements-store"
import { addDismissal } from "@/lib/announcement-dismissals-store"

// POST { id } → l'utilisateur courant ferme une annonce (fermeture enregistrée
// côté serveur, par compte). Refusé si l'annonce n'est pas fermable.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await request.json()
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }
    const ann = (await listAnnouncements()).find((a) => a.id === id)
    if (!ann) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 })
    if (ann.dismissible === false) {
      return NextResponse.json({ error: "Cette annonce n'est pas fermable" }, { status: 400 })
    }

    await addDismissal(id, user.id, user.nom)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
