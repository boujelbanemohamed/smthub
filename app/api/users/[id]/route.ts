import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
}

interface UserAccess {
  utilisateur_id: number
  application_id: number
}

async function readUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUsers(users: User[]) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

async function readUserAccess(): Promise<UserAccess[]> {
  try {
    const data = await fs.readFile(ACCESS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUserAccess(access: UserAccess[]) {
  await fs.writeFile(ACCESS_FILE, JSON.stringify(access, null, 2))
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const { nom, email, password, role } = await request.json()

    if (!nom || !email || !role) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const users = await readUsers()
    const userIndex = users.findIndex((user) => user.id === id)

    if (userIndex === -1) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    // Check if email is already used by another user
    const existingUser = users.find((user) => user.email === email && user.id !== id)
    if (existingUser) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
    }

    const updatedUser: User = {
      id,
      nom,
      email,
      mot_de_passe: password ? password : users[userIndex].mot_de_passe,
      role,
    }

    users[userIndex] = updatedUser
    await writeUsers(users)

    // Return user without password
    const { mot_de_passe, ...safeUser } = updatedUser
    return NextResponse.json(safeUser)
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const users = await readUsers()
    const filteredUsers = users.filter((user) => user.id !== id)

    if (filteredUsers.length === users.length) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    await writeUsers(filteredUsers)

    // Also remove user access rights
    const userAccess = await readUserAccess()
    const filteredAccess = userAccess.filter((access) => access.utilisateur_id !== id)
    await writeUserAccess(filteredAccess)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
