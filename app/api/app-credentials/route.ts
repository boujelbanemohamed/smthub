import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getCurrentUser } from "@/lib/auth"
import {
  listCredentialAppIds,
  getCredential,
  upsertCredential,
  deleteCredential,
} from "@/lib/app-credentials-store"
import { logError } from "@/lib/logger"

const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

// Vérifie que l'utilisateur a bien accès à l'application concernée.
async function userHasAccess(userId: number, appId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true // un admin voit toutes les applications sur son portail
  try {
    const data = await fs.readFile(ACCESS_FILE, "utf-8")
    const access: { utilisateur_id: number; application_id: number }[] = JSON.parse(data)
    return access.some((a) => a.utilisateur_id === userId && a.application_id === appId)
  } catch {
    return false
  }
}

// GET : sans paramètre → liste des app_id ayant un identifiant enregistré.
//       avec ?application_id= → identifiant déchiffré (propriétaire uniquement).
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const appIdParam = new URL(request.url).searchParams.get("application_id")

    if (!appIdParam) {
      const appIds = await listCredentialAppIds(user.id)
      return NextResponse.json({ appIds })
    }

    const appId = parseInt(appIdParam)
    if (Number.isNaN(appId)) {
      return NextResponse.json({ error: "application_id invalide" }, { status: 400 })
    }

    const cred = await getCredential(user.id, appId)
    if (!cred) return NextResponse.json({ error: "Aucun identifiant enregistré" }, { status: 404 })
    return NextResponse.json(cred)
  } catch (error) {
    await logError("Coffre-fort", "Lecture identifiant", error instanceof Error ? error.message : "Erreur")
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST : crée/met à jour l'identifiant de l'utilisateur pour une application.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { application_id, login, password, note } = await request.json()
    const appId = parseInt(application_id)

    if (Number.isNaN(appId) || !login || !password) {
      return NextResponse.json({ error: "Application, login et mot de passe requis" }, { status: 400 })
    }

    if (!(await userHasAccess(user.id, appId, user.role === "admin"))) {
      return NextResponse.json({ error: "Accès à cette application non autorisé" }, { status: 403 })
    }

    await upsertCredential(user.id, appId, String(login), String(password), note ? String(note) : "")
    return NextResponse.json({ success: true })
  } catch (error) {
    await logError("Coffre-fort", "Enregistrement identifiant", error instanceof Error ? error.message : "Erreur")
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 })
  }
}

// DELETE : supprime l'identifiant de l'utilisateur pour une application.
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const appIdParam = new URL(request.url).searchParams.get("application_id")
    const appId = parseInt(appIdParam || "")
    if (Number.isNaN(appId)) {
      return NextResponse.json({ error: "application_id invalide" }, { status: 400 })
    }

    const removed = await deleteCredential(user.id, appId)
    if (!removed) return NextResponse.json({ error: "Aucun identifiant à supprimer" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
