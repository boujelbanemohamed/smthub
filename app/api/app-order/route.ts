import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getOrder, setOrder, clearOrder } from "@/lib/app-order-store"

// GET → ordre personnel de l'utilisateur courant.
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    return NextResponse.json({ order: await getOrder(me.id) })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT { order: number[] } → enregistre l'ordre. { reset: true } → réinitialise.
export async function PUT(request: NextRequest) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    if (body?.reset) {
      await clearOrder(me.id)
      return NextResponse.json({ success: true, order: [] })
    }
    if (!Array.isArray(body?.order)) return NextResponse.json({ error: "Ordre invalide" }, { status: 400 })
    await setOrder(me.id, body.order)
    return NextResponse.json({ success: true, order: await getOrder(me.id) })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
