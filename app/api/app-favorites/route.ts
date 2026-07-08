import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { listFavorites, toggleFavorite } from "@/lib/favorites-store"

// GET → liste des application_id favorites de l'utilisateur courant.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const appIds = await listFavorites(user.id)
  return NextResponse.json({ appIds })
}

// POST { application_id } → bascule le favori. Renvoie { favorite: boolean }.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { application_id } = await request.json()
  const appId = parseInt(application_id)
  if (Number.isNaN(appId)) {
    return NextResponse.json({ error: "application_id invalide" }, { status: 400 })
  }
  const favorite = await toggleFavorite(user.id, appId)
  return NextResponse.json({ favorite })
}
