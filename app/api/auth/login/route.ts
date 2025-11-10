import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

async function readUsers(): Promise<any[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL

    let user: any | null = null
    if (usePostgres) {
      try {
        user = await prisma.user.findUnique({ where: { email } })
      } catch (e) {
        console.error("Erreur Prisma (login), fallback JSON:", e)
      }
    }
    if (!user) {
      const users = await readUsers()
      user = users.find((u) => u.email === email) || null
    }

    if (!user) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      )
    }

    // Password check: prefer plaintext equality; if stored value looks like a bcrypt hash, fallback to bcrypt compare
    let isValidPassword = false
    const stored = user.mot_de_passe || ""
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      isValidPassword = await bcrypt.compare(password, stored)
    } else {
      isValidPassword = stored === password
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      )
    }

    // Créer une session
    const sessionData = {
      id: user.id,
      nom: user.nom,
      email: user.email,
      role: user.role,
    }

    const cookieStore = cookies()
    cookieStore.set("user-session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    })

    return NextResponse.json({
      success: true,
      message: "Connexion réussie",
      user: sessionData,
    })
  } catch (error) {
    console.error("Erreur de connexion:", error)
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
