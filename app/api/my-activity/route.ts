import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getLogs } from "@/lib/logger"

// GET → activité personnelle de l'utilisateur connecté (tous rôles) :
//  - ses ouvertures d'applications
//  - les événements concernant son compte (accès accordés/retirés, profil modifié)
// Historique complet (aucune limite 48 h : il s'agit de SA propre activité).
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const logs = await getLogs({ userId: me.id, limit: 100000 })
    const opens = logs
      .filter((l) => l.action === "Ouverture application")
      .map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        appName: l.metadata?.appName || `Application ${l.metadata?.appId ?? "?"}`,
        appId: l.metadata?.appId ?? null,
      }))
    const events = logs
      .filter((l) => l.action !== "Ouverture application")
      .map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        action: l.action,
        details: l.details,
        level: l.level,
      }))

    return NextResponse.json({
      opens,
      events,
      totalOpens: opens.length,
      totalEvents: events.length,
    })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
