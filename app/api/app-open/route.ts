import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { logApplicationAction } from "@/lib/logger"

// POST { application_id, nom } → journalise l'ouverture d'une application par
// l'utilisateur courant. Sert de base aux statistiques d'usage.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { application_id, nom } = await request.json()
    const appId = Number(application_id)
    if (Number.isNaN(appId)) return NextResponse.json({ error: "application_id requis" }, { status: 400 })

    await logApplicationAction(
      "Ouverture application",
      appId,
      typeof nom === "string" ? nom : `Application ${appId}`,
      user.id,
      user.nom,
      `Ouverture de l'application par ${user.nom}`
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
