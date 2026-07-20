import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isBankAdmin } from "@/lib/auth"
import { getBank, bankUserIds } from "@/lib/banks-store"
import { logAccessAction, logError } from "@/lib/logger"
import { notify } from "@/lib/notifications-store"
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
    const me = await requireAdmin()
    let userAccess = await readUserAccess()
    // Cloisonnement : un admin de banque ne voit que les accès de ses utilisateurs.
    if (isBankAdmin(me)) {
      const ids = await bankUserIds(me.banque_id!)
      userAccess = userAccess.filter((a: any) => ids.has(a.utilisateur_id))
    }
    return NextResponse.json(userAccess)
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// Vérifie qu'un admin de banque a le droit d'agir sur ce couple (utilisateur,
// application) : l'utilisateur doit être de sa banque ET l'application doit
// être attribuée à sa banque. Renvoie un message d'erreur, ou null si OK.
async function bankScopeError(me: any, utilisateurId: number, applicationId: number): Promise<string | null> {
  if (!isBankAdmin(me)) return null
  const user = await getUserById(utilisateurId)
  if (!user || user.banque_id !== me.banque_id) return "Utilisateur hors de votre banque"
  const bank = await getBank(me.banque_id)
  if (!bank || !bank.app_ids.includes(Number(applicationId))) return "Application non attribuée à votre banque"
  return null
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin()

    const { utilisateur_id, application_id } = await request.json()
    const scopeErr = await bankScopeError(me, Number(utilisateur_id), Number(application_id))
    if (scopeErr) return NextResponse.json({ error: scopeErr }, { status: 403 })
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
    await notify(Number(utilisateur_id), {
      type: "access_granted",
      message: `L'accès à « ${app?.nom || "une application"} » vous a été accordé.`,
      link: app?.app_url || null,
    })

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
    const me = await requireAdmin()

    const { utilisateur_id, application_id } = await request.json()
    const scopeErr = await bankScopeError(me, Number(utilisateur_id), Number(application_id))
    if (scopeErr) return NextResponse.json({ error: scopeErr }, { status: 403 })
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
    await notify(Number(utilisateur_id), {
      type: "access_revoked",
      message: `Votre accès à « ${app?.nom || "une application"} » a été retiré.`,
    })

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
