import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { logAccessAction, logError } from "@/lib/logger"
import { promises as fs } from "fs"
import path from "path"

const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")

async function readUserAccess() {
  try {
    const data = await fs.readFile(ACCESS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUserAccess(access: any[]) {
  const dir = path.dirname(ACCESS_FILE)
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
  await fs.writeFile(ACCESS_FILE, JSON.stringify(access, null, 2))
}

async function getUserById(userId: number) {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    const users = JSON.parse(data)
    return users.find((u: any) => u.id === userId)
  } catch {
    return null
  }
}

async function getApplicationById(appId: number) {
  try {
    const data = await fs.readFile(APPLICATIONS_FILE, "utf-8")
    const apps = JSON.parse(data)
    return apps.find((a: any) => a.id === appId)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    await requireAdmin()
    const userAccess = await readUserAccess()
    return NextResponse.json(userAccess)
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { utilisateur_id, application_id } = await request.json()
    const userAccess = await readUserAccess()

    const existingAccess = userAccess.find(
      (access: any) => access.utilisateur_id === utilisateur_id && access.application_id === application_id
    )

    if (existingAccess) {
      await logError(
        "Accord d'accès",
        `Tentative d'accord d'accès déjà existant: Utilisateur ${utilisateur_id} → Application ${application_id}`,
        "Accès déjà accordé"
      )
      return NextResponse.json({ error: "Accès déjà accordé" }, { status: 400 })
    }

    const newAccess = { utilisateur_id, application_id }
    userAccess.push(newAccess)
    await writeUserAccess(userAccess)

    const [user, app] = await Promise.all([
      getUserById(utilisateur_id),
      getApplicationById(application_id)
    ])

    await logAccessAction(
      "Accord d'accès",
      utilisateur_id,
      user?.nom || `Utilisateur ${utilisateur_id}`,
      application_id,
      app?.nom || `Application ${application_id}`,
      `Accès accordé: ${user?.nom || `Utilisateur ${utilisateur_id}`} → ${app?.nom || `Application ${application_id}`}`
    )

    return NextResponse.json(newAccess, { status: 201 })
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'accès:", error)
    await logError(
      "Accord d'accès",
      "Erreur lors de l'accord d'un accès",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de l'ajout de l'accès" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()

    const { utilisateur_id, application_id } = await request.json()
    const userAccess = await readUserAccess()

    const existingAccess = userAccess.find(
      (access: any) => access.utilisateur_id === utilisateur_id && access.application_id === application_id
    )

    if (!existingAccess) {
      await logError(
        "Révocation d'accès",
        `Tentative de révocation d'accès inexistant: Utilisateur ${utilisateur_id} → Application ${application_id}`,
        "Accès non trouvé"
      )
      return NextResponse.json({ error: "Accès non trouvé" }, { status: 404 })
    }

    const filtered = userAccess.filter(
      (access: any) => !(access.utilisateur_id === utilisateur_id && access.application_id === application_id)
    )
    await writeUserAccess(filtered)

    const [user, app] = await Promise.all([
      getUserById(utilisateur_id),
      getApplicationById(application_id)
    ])

    await logAccessAction(
      "Révocation d'accès",
      utilisateur_id,
      user?.nom || `Utilisateur ${utilisateur_id}`,
      application_id,
      app?.nom || `Application ${application_id}`,
      `Accès révoqué: ${user?.nom || `Utilisateur ${utilisateur_id}`} → ${app?.nom || `Application ${application_id}`}`
    )

    return NextResponse.json({ message: "Accès révoqué" })
  } catch (error) {
    console.error("Erreur lors de la révocation de l'accès:", error)
    await logError(
      "Révocation d'accès",
      "Erreur lors de la révocation d'un accès",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la révocation de l'accès" }, { status: 500 })
  }
}
