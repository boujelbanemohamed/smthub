import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"

const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")
const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

async function readApplications() {
  try {
    const data = await fs.readFile(APPLICATIONS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function readUserAccess() {
  try {
    const data = await fs.readFile(ACCESS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Vérification d'authentification
async function getCurrentUser() {
  try {
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    
    if (session?.value) {
      const userData = JSON.parse(session.value)
      return userData
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const [applications, userAccess] = await Promise.all([readApplications(), readUserAccess()])

    // Si l'utilisateur est admin, il a accès à toutes les applications
    if (currentUser.role === "admin") {
      const sortedApps = applications.sort((a, b) => a.ordre_affichage - b.ordre_affichage)
      return NextResponse.json(sortedApps)
    }

    // Pour les utilisateurs standards, filtrer selon leurs droits d'accès
    const userAppIds = userAccess
      .filter((access) => access.utilisateur_id === currentUser.id)
      .map((access) => access.application_id)

    const userApplications = applications
      .filter((app) => userAppIds.includes(app.id))
      .sort((a, b) => a.ordre_affichage - b.ordre_affichage)

    return NextResponse.json(userApplications)
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
