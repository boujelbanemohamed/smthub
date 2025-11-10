import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { logUserAction, logError } from "@/lib/logger"
import { requireAdmin } from "@/lib/auth"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
}

async function readUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUsers(users: User[]): Promise<void> {
  const dataDir = path.dirname(USERS_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

export async function GET() {
  try {
    await requireAdmin()
    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
    if (usePostgres) {
      const users = await prisma.user.findMany({ orderBy: { id: "asc" } })
      const safe = users.map(({ mot_de_passe, ...u }) => u)
      return NextResponse.json(safe)
    } else {
      const users = await readUsers()
      const usersWithoutPasswords = users.map(({ mot_de_passe, ...user }) => user)
      return NextResponse.json(usersWithoutPasswords)
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const userData = await request.json()

    // Validation des données requises
    if (!userData.nom || !userData.email || !userData.mot_de_passe) {
      await logError(
        "Création utilisateur",
        `Tentative de création avec données manquantes: ${JSON.stringify(userData)}`,
        "Données requises manquantes"
      )
      return NextResponse.json({
        error: "Nom, email et mot de passe sont requis"
      }, { status: 400 })
    }

    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
    if (usePostgres) {
      const existing = await prisma.user.findUnique({ where: { email: userData.email } })
      if (existing) {
        await logError(
          "Création utilisateur",
          `Tentative de création avec email existant: ${userData.email}`,
          "Email déjà utilisé"
        )
        return NextResponse.json({
          error: "Un utilisateur avec cet email existe déjà"
        }, { status: 409 })
      }
    } else {
      const users = await readUsers()
      const existingUser = users.find(user => user.email === userData.email)
      if (existingUser) {
        await logError(
          "Création utilisateur",
          `Tentative de création avec email existant: ${userData.email}`,
          "Email déjà utilisé"
        )
        return NextResponse.json({
          error: "Un utilisateur avec cet email existe déjà"
        }, { status: 409 })
      }
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(userData.mot_de_passe, 10)

    let responseUser: any
    if (usePostgres) {
      const created = await prisma.user.create({
        data: {
          nom: userData.nom,
          email: userData.email,
          role: userData.role || "utilisateur",
          mot_de_passe: hashedPassword
        },
        select: { id: true, nom: true, email: true, role: true }
      })
      responseUser = created
    } else {
      const users = await readUsers()
      const newId = Math.max(...users.map(u => u.id), 0) + 1
      const newUser = {
        id: newId,
        nom: userData.nom,
        email: userData.email,
        role: userData.role || "utilisateur",
        mot_de_passe: hashedPassword
      }
      users.push(newUser)
      await writeUsers(users)
      const { mot_de_passe, ...safe } = newUser
      responseUser = safe
    }

    // Logger l'action
    await logUserAction(
      "Création utilisateur",
      responseUser.id,
      responseUser.nom,
      `Utilisateur créé: ${responseUser.nom} (${responseUser.email}) avec le rôle ${responseUser.role || "utilisateur"}`
    )

    // Retourner l'utilisateur sans le mot de passe
    return NextResponse.json(responseUser, { status: 201 })
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error)
    await logError(
      "Création utilisateur",
      "Erreur lors de la création d'un utilisateur",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
