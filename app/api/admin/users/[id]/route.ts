import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { logUserAction, logError } from "@/lib/logger"
import { requireAdmin } from "@/lib/auth"
import { promises as fs } from "fs"
import path from "path"

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const userId = parseInt(params.id)
    const userData = await request.json()

    const users = await readUsers()
    const userIndex = users.findIndex(user => user.id === userId)
    if (userIndex === -1) {
      await logError(
        "Modification utilisateur",
        `Tentative de modification d'un utilisateur inexistant: ${userId}`,
        "Utilisateur non trouvé"
      )
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    const oldUser = users[userIndex]
    const changes = []

    // Préparer les données de mise à jour
    const updateData: any = {
      nom: userData.nom,
      email: userData.email,
      role: userData.role
    }

    // Détecter les changements
    if (oldUser.nom !== userData.nom) changes.push(`Nom: ${oldUser.nom} → ${userData.nom}`)
    if (oldUser.email !== userData.email) changes.push(`Email: ${oldUser.email} → ${userData.email}`)
    if (oldUser.role !== userData.role) changes.push(`Rôle: ${oldUser.role} → ${userData.role}`)

    // Si un mot de passe est fourni, le hacher
    if (userData.mot_de_passe && userData.mot_de_passe.trim() !== "") {
      updateData.mot_de_passe = await bcrypt.hash(userData.mot_de_passe, 10)
      changes.push("Mot de passe modifié")
      console.log(`Mot de passe changé pour l'utilisateur ${userId}`)
    }

    // Mettre à jour l'utilisateur
    users[userIndex] = { ...users[userIndex], ...updateData }
    await writeUsers(users)

    // Logger l'action
    await logUserAction(
      "Modification utilisateur",
      userId,
      oldUser.nom,
      `Utilisateur modifié: ${oldUser.nom} (${oldUser.email}). Changements: ${changes.join(", ")}`
    )

    // Retourner l'utilisateur sans le mot de passe
    const { mot_de_passe, ...userResponse } = users[userIndex]
    return NextResponse.json(userResponse)
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'utilisateur:", error)
    await logError(
      "Modification utilisateur",
      "Erreur lors de la modification d'un utilisateur",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const userId = parseInt(params.id)
    const users = await readUsers()
    const userIndex = users.findIndex(user => user.id === userId)

    if (userIndex === -1) {
      await logError(
        "Suppression utilisateur",
        `Tentative de suppression d'un utilisateur inexistant: ${userId}`,
        "Utilisateur non trouvé"
      )
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    const deletedUser = users[userIndex]
    users.splice(userIndex, 1)
    await writeUsers(users)

    // Logger l'action
    await logUserAction(
      "Suppression utilisateur",
      userId,
      deletedUser.nom,
      `Utilisateur supprimé: ${deletedUser.nom} (${deletedUser.email})`
    )

    return NextResponse.json({ message: "Utilisateur supprimé" })
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error)
    await logError(
      "Suppression utilisateur",
      "Erreur lors de la suppression d'un utilisateur",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
