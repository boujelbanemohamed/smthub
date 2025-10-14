import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { sendEmail, generateWelcomeEmail } from "@/lib/email-service"
import { cache } from "@/lib/cache"

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
  const cached = cache.get('users')
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
    const users = await readUsers()
    // Remove passwords from response
    const safeUsers = users.map(({ mot_de_passe, ...user }) => user)
    return NextResponse.json(safeUsers)
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nom, email, password, role } = await request.json()

    if (!nom || !email || !password || !role) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const users = await readUsers()

    // Check if email already exists
    if (users.some((user) => user.email === email)) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
    }

    const newId = Math.max(0, ...users.map((user) => user.id)) + 1

    const newUser: User = {
      id: newId,
      nom,
      email,
      mot_de_passe: password,
      role,
    }

    users.push(newUser)
    await writeUsers(users)

    // Envoyer l'email de bienvenue (en arrière-plan)
    try {
      const welcomeEmail = generateWelcomeEmail(newUser.nom, newUser.email)
      await sendEmail(welcomeEmail)
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de bienvenue:", emailError)
      // Ne pas faire échouer la création si l'email ne peut pas être envoyé
    }

    // Return user without password
    const { mot_de_passe, ...safeUser } = newUser
    return NextResponse.json(safeUser, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
