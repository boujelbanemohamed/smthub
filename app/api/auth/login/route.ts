import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logError, logUserAction } from "@/lib/logger"
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session"
import { touchLastLogin } from "@/lib/presence-store"
import { checkRateLimit } from "@/lib/auth"

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

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!checkRateLimit(`login:${clientIp}:${email}`)) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      )
    }

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
      await logError("Login", `Echec connexion: ${email}`, "Email inconnu")
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      )
    }

    // Vérification du mot de passe : uniquement via bcrypt. Un mot de passe
    // stocké en clair (hash invalide) renvoie false → jamais accepté.
    const stored = user.mot_de_passe || ""
    const isValidPassword = stored ? await bcrypt.compare(password, stored) : false

    if (!isValidPassword) {
      await logError("Login", `Echec connexion: ${email}`, "Mot de passe incorrect", user?.id, user?.nom)
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

    const token = await signSession(sessionData)
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    })

    await touchLastLogin(user.id)
    await logUserAction("Login", user.id, user.nom, `Connexion réussie: ${user.email}`)

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
