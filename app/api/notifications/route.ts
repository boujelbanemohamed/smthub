import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { listForUser, unreadCount, markRead, markAllRead } from "@/lib/notifications-store"

// GET → notifications de l'utilisateur courant + nombre de non-lues.
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const [notifications, unread] = await Promise.all([listForUser(me.id), unreadCount(me.id)])
    return NextResponse.json({ notifications, unread })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { ids: string[] } → marque comme lues ; { all: true } → tout marquer lu.
export async function POST(request: NextRequest) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    if (body?.all) await markAllRead(me.id)
    else if (Array.isArray(body?.ids)) await markRead(me.id, body.ids.map((x: any) => String(x)))
    return NextResponse.json({ success: true, unread: await unreadCount(me.id) })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
