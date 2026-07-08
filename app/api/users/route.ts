import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { sendEmail, generateSetPasswordEmail } from "@/lib/email-service"
import { cache } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { requireAdmin } from "@/lib/auth"
import { createResetToken } from "@/lib/password-reset"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
}

async function readUsers(): Promise<User[]> {
  // Vérifier le cache d'abord
  const cached = cache.get<User[]>('users')
  if (cached) return cached

  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    const users = JSON.parse(data)
    cache.set('users', users, 5 * 60 * 1000)
    return users
  } catch {
    // Fallback: valeurs par défaut si le fichier n'existe pas encore
    const defaultUsers: User[] = [
      { id: 1, nom: "Admin User", email: "admin@smt.com", role: "admin", mot_de_passe: "" },
      { id: 2, nom: "John Doe", email: "user@smt.com", role: "utilisateur", mot_de_passe: "" },
    ]
    cache.set('users', defaultUsers, 5 * 60 * 1000)
    return defaultUsers
  }
}

async function writeUsers(users: User[]) {
  try {
    const dataDir = path.dirname(USERS_FILE)
    try {
      await fs.access(dataDir)
    } catch {
      await fs.mkdir(dataDir, { recursive: true })
    }
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
    
    // Invalider le cache après écriture
    cache.delete('users')
  } catch (error) {
    console.error('Erreur lors de l\'écriture des utilisateurs:', error)
  }
}

export async function GET() {
  try {
    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
    if (usePostgres) {
      const users = await prisma.user.findMany({ orderBy: { id: "asc" } })
      const safe = users.map(({ mot_de_passe, ...u }: any) => u)
      return NextResponse.json(safe)
    } else {
      const users = await readUsers()
      const safeUsers = users.map(({ mot_de_passe, ...user }) => user)
      return NextResponse.json(safeUsers)
    }
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { nom, email, password, role } = await request.json()

    if (!nom || !email || !password || !role) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
    let created: any
    if (usePostgres) {
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
      }
      created = await prisma.user.create({
        data: { nom, email, role, mot_de_passe: hashedPassword },
        select: { id: true, nom: true, email: true, role: true },
      })
    } else {
      const users = await readUsers()
      if (users.some((user) => user.email === email)) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
      }
      const newId = Math.max(0, ...users.map((user) => user.id)) + 1
      const newUser: User = {
        id: newId,
        nom,
        email,
        mot_de_passe: hashedPassword,
        role,
      }
      users.push(newUser)
      await writeUsers(users)
      const { mot_de_passe, ...safe } = newUser
      created = safe
    }

    // Email de bienvenue avec un lien de définition de mot de passe (jamais de mot
    // de passe en clair). Le mot de passe fourni par l'admin sert d'initialisation,
    // l'utilisateur définit le sien via le lien sécurisé.
    try {
      const token = await createResetToken(created.id, created.email, 24 * 60)
      const proto = request.headers.get("x-forwarded-proto") || "http"
      const host = request.headers.get("host") || "localhost:4000"
      const origin = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`
      const setUrl = `${origin}/reset-password?token=${token}`
      await sendEmail(generateSetPasswordEmail(created.nom, created.email, setUrl))
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email d'activation:", emailError)
      // Ne pas faire échouer la création si l'email ne peut pas être envoyé
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
