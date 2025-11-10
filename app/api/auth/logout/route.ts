import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { logUserAction, logError } from "@/lib/logger"

export async function POST() {
  try {
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    let userId: number | undefined
    let userName: string | undefined
    if (session?.value) {
      try {
        const userData = JSON.parse(session.value)
        userId = userData.id
        userName = userData.nom
      } catch {}
    }
    cookieStore.delete("user-session")
    await logUserAction("Logout", userId || 0, userName || "Utilisateur", "Déconnexion réussie")
    return NextResponse.json({ success: true })
  } catch (error) {
    await logError("Logout", "Erreur de déconnexion", error instanceof Error ? error.message : "Erreur inconnue")
    return NextResponse.json({ error: "Erreur de déconnexion" }, { status: 500 })
  }
}
