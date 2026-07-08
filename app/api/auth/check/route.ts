import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (user) {
      return NextResponse.json({ isAuthenticated: true, user })
    }
    return NextResponse.json({ isAuthenticated: false }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 })
  }
}
