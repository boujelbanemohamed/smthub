import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")

    if (session?.value) {
      const userData = JSON.parse(session.value)
      return NextResponse.json({ isAuthenticated: true, user: userData })
    } else {
      return NextResponse.json({ isAuthenticated: false }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 })
  }
}
