import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getLogs } from "@/lib/logger"

// GET → ids des dernières applications ouvertes par l'utilisateur (distinctes,
// de la plus récente à la plus ancienne, max 5).
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const logs = await getLogs({ userId: me.id, action: "Ouverture application", limit: 100000 })
    // getLogs renvoie déjà trié desc (plus récent d'abord) côté JSON ; on
    // déduplique en conservant le premier vu (le plus récent).
    const seen = new Set<number>()
    const ids: number[] = []
    for (const l of logs) {
      const id = l.metadata?.appId
      if (typeof id === "number" && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
        if (ids.length >= 5) break
      }
    }
    return NextResponse.json({ recent: ids })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
