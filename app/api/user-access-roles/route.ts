import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, getCurrentUser } from "@/lib/auth"
import { logAccessChange } from "@/app/api/access-history/route"
import { sendEmail, generateAccessChangeEmail } from "@/lib/email-service"

const USER_ACCESS_ROLES_FILE = path.join(process.cwd(), "data", "user-access-roles.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")

export type AccessLevel = "read" | "write" | "admin" | "none"

interface UserAccessRole {
  utilisateur_id: number
  application_id: number
  access_level: AccessLevel
  granted_by: number // ID de l'admin qui a accordé l'accès
  granted_at: string // Date d'attribution
  last_modified: string // Dernière modification
}

async function readUserAccessRoles(): Promise<UserAccessRole[]> {
  try {
    const data = await fs.readFile(USER_ACCESS_ROLES_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUserAccessRoles(roles: UserAccessRole[]) {
  const dataDir = path.dirname(USER_ACCESS_ROLES_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(USER_ACCESS_ROLES_FILE, JSON.stringify(roles, null, 2))
}

async function getUserById(userId: number) {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    const users = JSON.parse(data)
    return users.find((user: any) => user.id === userId)
  } catch {
    return null
  }
}

async function getApplicationById(appId: number) {
  try {
    const data = await fs.readFile(APPLICATIONS_FILE, "utf-8")
    const applications = JSON.parse(data)
    return applications.find((app: any) => app.id === appId)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    const appId = searchParams.get("app_id")
    
    let roles = await readUserAccessRoles()
    
    // Filter by user if specified
    if (userId) {
      roles = roles.filter(role => role.utilisateur_id === parseInt(userId))
    }
    
    // Filter by application if specified
    if (appId) {
      roles = roles.filter(role => role.application_id === parseInt(appId))
    }
    
    return NextResponse.json(roles)
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const { utilisateur_id, application_id, access_level } = await request.json()

    // Validation
    if (!utilisateur_id || !application_id || !access_level) {
      return NextResponse.json({
        error: "Les champs utilisateur_id, application_id et access_level sont requis"
      }, { status: 400 })
    }

    const validLevels: AccessLevel[] = ["read", "write", "admin", "none"]
    if (!validLevels.includes(access_level)) {
      return NextResponse.json({
        error: "Niveau d'accès invalide. Valeurs autorisées: read, write, admin, none"
      }, { status: 400 })
    }

    const roles = await readUserAccessRoles()
    const now = new Date().toISOString()

    // Find existing role to track changes
    const existingRoleIndex = roles.findIndex(
      role => role.utilisateur_id === utilisateur_id && role.application_id === application_id
    )

    const oldLevel = existingRoleIndex !== -1 ? roles[existingRoleIndex].access_level : "none"

    if (access_level === "none") {
      // Remove access
      if (existingRoleIndex !== -1) {
        roles.splice(existingRoleIndex, 1)

        // Log the change
        await logAccessChange(
          utilisateur_id,
          application_id,
          "revoked",
          admin.id,
          oldLevel,
          "none",
          request
        )
      }
    } else {
      // Add or update access
      const roleData: UserAccessRole = {
        utilisateur_id,
        application_id,
        access_level,
        granted_by: admin.id,
        granted_at: existingRoleIndex === -1 ? now : roles[existingRoleIndex].granted_at,
        last_modified: now
      }

      if (existingRoleIndex !== -1) {
        roles[existingRoleIndex] = roleData

        // Log the change
        await logAccessChange(
          utilisateur_id,
          application_id,
          oldLevel === "none" ? "granted" : "modified",
          admin.id,
          oldLevel,
          access_level,
          request
        )
      } else {
        roles.push(roleData)

        // Log the change
        await logAccessChange(
          utilisateur_id,
          application_id,
          "granted",
          admin.id,
          "none",
          access_level,
          request
        )
      }
    }

    await writeUserAccessRoles(roles)

    // Send email notification (in background)
    try {
      const [user, application] = await Promise.all([
        getUserById(utilisateur_id),
        getApplicationById(application_id)
      ])

      if (user && application) {
        const emailOptions = generateAccessChangeEmail(
          user.nom,
          user.email,
          application.nom,
          oldLevel === "none" ? "granted" : (access_level === "none" ? "revoked" : "modified"),
          oldLevel !== "none" ? oldLevel : undefined,
          access_level !== "none" ? access_level : undefined,
          admin.nom
        )

        await sendEmail(emailOptions)
      }
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de notification d'accès:", emailError)
      // Ne pas faire échouer la requête si l'email ne peut pas être envoyé
    }

    return NextResponse.json({
      success: true,
      message: "Niveau d'accès mis à jour avec succès"
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    console.error("Erreur lors de la mise à jour du niveau d'accès:", error)
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    const appId = searchParams.get("app_id")
    
    if (!userId || !appId) {
      return NextResponse.json({ 
        error: "Les paramètres user_id et app_id sont requis" 
      }, { status: 400 })
    }
    
    const roles = await readUserAccessRoles()
    const filteredRoles = roles.filter(
      role => !(role.utilisateur_id === parseInt(userId) && role.application_id === parseInt(appId))
    )
    
    await writeUserAccessRoles(filteredRoles)
    
    return NextResponse.json({ 
      success: true, 
      message: "Accès supprimé avec succès" 
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    console.error("Erreur lors de la suppression de l'accès:", error)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
