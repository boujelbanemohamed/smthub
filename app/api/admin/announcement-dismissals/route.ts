import { NextResponse } from "next/server"
import { requireAdmin, authErrorResponse } from "@/lib/auth"
import { listAnnouncements } from "@/lib/announcements-store"
import { listDismissals } from "@/lib/announcement-dismissals-store"

// GET → pour chaque annonce FERMABLE, la liste des utilisateurs qui l'ont fermée.
export async function GET() {
  try {
    await requireAdmin()
    const [anns, dismissals] = await Promise.all([listAnnouncements(), listDismissals()])

    const rows = anns
      .filter((a) => a.dismissible !== false)
      .map((a) => {
        const users = dismissals
          .filter((d) => d.announcement_id === a.id)
          .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
          .map((d) => ({ id: d.utilisateur_id, nom: d.user_name, at: d.at }))
        return { id: a.id, message: a.message, level: a.level, active: a.active, count: users.length, users }
      })
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ announcements: rows })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
