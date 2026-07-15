import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getCurrentUser, isSuperAdmin, isBankAdmin } from "@/lib/auth"
import { getBank } from "@/lib/banks-store"

const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")
const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
}

interface UserAccess {
  utilisateur_id: number
  application_id: number
}

async function readApplications(): Promise<Application[]> {
  try {
    const data = await fs.readFile(APPLICATIONS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function readUserAccess(): Promise<UserAccess[]> {
  try {
    const data = await fs.readFile(ACCESS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const [applications, userAccess] = await Promise.all([readApplications(), readUserAccess()])

    // Super-admin (admin sans banque) → toutes les applications.
    if (isSuperAdmin(currentUser)) {
      const sortedApps = applications.sort((a, b) => a.ordre_affichage - b.ordre_affichage)
      return NextResponse.json(sortedApps)
    }

    // Admin de banque → applications qui lui sont accordées individuellement
    // (user_access), en restant bornées aux applis attribuées à sa banque.
    // Ainsi, révoquer un accès dans « Gestion des accès » le retire aussi de
    // son tableau de bord. Par défaut, à sa création, tous les accès de la
    // banque lui sont accordés (voir lib/access-seed).
    if (isBankAdmin(currentUser)) {
      const bank = await getBank(currentUser.banque_id as number)
      const allowed = new Set(bank?.app_ids || [])
      const grantedIds = new Set(
        userAccess
          .filter((access) => access.utilisateur_id === currentUser.id)
          .map((access) => access.application_id)
      )
      const bankApps = applications
        .filter((app) => allowed.has(app.id) && grantedIds.has(app.id))
        .sort((a, b) => a.ordre_affichage - b.ordre_affichage)
      return NextResponse.json(bankApps)
    }

    // Utilisateurs standards → uniquement leurs droits d'accès individuels.
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
