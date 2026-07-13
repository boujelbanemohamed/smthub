import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { logUserAction, logError } from "@/lib/logger"
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session"
import { clearPresence } from "@/lib/presence-store"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE_NAME)
    let userId: number | undefined
    let userName: string | undefined
    if (session?.value) {
      const userData = await verifySession(session.value)
      if (userData) {
        userId = userData.id
        userName = userData.nom
      }
    }
    cookieStore.delete(SESSION_COOKIE_NAME)
    if (userId) await clearPresence(userId)
    await logUserAction("Logout", userId || 0, userName || "Utilisateur", "Déconnexion réussie")
    return NextResponse.json({ success: true })
  } catch (error) {
    await logError("Logout", "Erreur de déconnexion", error instanceof Error ? error.message : "Erreur inconnue")
    return NextResponse.json({ error: "Erreur de déconnexion" }, { status: 500 })
  }
}
