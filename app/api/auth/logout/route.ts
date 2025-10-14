import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const cookieStore = cookies()
    cookieStore.delete("user-session")
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erreur de déconnexion" }, { status: 500 })
  }
}
