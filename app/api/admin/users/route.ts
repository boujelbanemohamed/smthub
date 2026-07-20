import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { logUserAction, logError } from "@/lib/logger"
import { requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { sanitizeAvatar } from "@/lib/user-store"
import { grantAllBankApps } from "@/lib/access-seed"
import { notifyMany } from "@/lib/notifications-store"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
  avatar?: string | null
  banque_id?: number | null
  actif?: boolean
  access_initialized?: boolean
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

export async function GET() {
  try {
    const me = await requireAdmin()
    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
    if (usePostgres) {
      const users = await prisma.user.findMany({ orderBy: { id: "asc" } })
      const safe = users.map(({ mot_de_passe, ...u }: any) => u)
      return NextResponse.json(safe)
    } else {
      let users = await readUsers()
      // Cloisonnement : un admin de banque ne voit que les utilisateurs de sa banque.
      if (isBankAdmin(me)) {
        users = users.filter((u: any) => u.banque_id === me.banque_id)
      }
      const usersWithoutPasswords = users.map(({ mot_de_passe, ...user }) => user)
      return NextResponse.json(usersWithoutPasswords)
    }
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin()

    const userData = await request.json()

    // Rôle demandé (par défaut utilisateur). Seuls admin/utilisateur sont valides.
    const wantedRole = userData.role === "admin" ? "admin" : "utilisateur"
    // Cloisonnement : un admin de banque crée forcément dans SA banque ; un
    // super-admin choisit la banque (ou aucune). `actif` par défaut true.
    const bankAdmin = isBankAdmin(me)
    const banqueId = bankAdmin
      ? me.banque_id!
      : (userData.banque_id === null || userData.banque_id === undefined || userData.banque_id === ""
          ? null
          : Number(userData.banque_id))
    const actif = userData.actif === false ? false : true

    // Validation des données requises
    if (!userData.nom || !userData.email || !userData.mot_de_passe) {
      await logError(
        "Création utilisateur",
        `Tentative de création avec données manquantes: ${JSON.stringify(userData)}`,
        "Données requises manquantes"
      )
      return NextResponse.json({
        error: "Nom, email et mot de passe sont requis"
      }, { status: 400 })
    }

    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
    if (usePostgres) {
      const existing = await prisma.user.findUnique({ where: { email: userData.email } })
      if (existing) {
        await logError(
          "Création utilisateur",
          `Tentative de création avec email existant: ${userData.email}`,
          "Email déjà utilisé"
        )
        return NextResponse.json({
          error: "Un utilisateur avec cet email existe déjà"
        }, { status: 409 })
      }
    } else {
      const users = await readUsers()
      const existingUser = users.find(user => user.email === userData.email)
      if (existingUser) {
        await logError(
          "Création utilisateur",
          `Tentative de création avec email existant: ${userData.email}`,
          "Email déjà utilisé"
        )
        return NextResponse.json({
          error: "Un utilisateur avec cet email existe déjà"
        }, { status: 409 })
      }
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(userData.mot_de_passe, 10)

    const avatarValue = sanitizeAvatar(userData.avatar)

    let responseUser: any
    if (usePostgres) {
      const created = await prisma.user.create({
        data: {
          nom: userData.nom,
          email: userData.email,
          role: wantedRole,
          mot_de_passe: hashedPassword,
          ...(avatarValue !== undefined ? { avatar: avatarValue } : {})
        },
        select: { id: true, nom: true, email: true, role: true, avatar: true }
      })
      responseUser = created
    } else {
      const users = await readUsers()
      const newId = Math.max(...users.map(u => u.id), 0) + 1
      const finalBanqueId = Number.isNaN(banqueId as number) ? null : banqueId
      const isNewBankAdmin = wantedRole === "admin" && finalBanqueId != null
      const newUser: User = {
        id: newId,
        nom: userData.nom,
        email: userData.email,
        role: wantedRole,
        mot_de_passe: hashedPassword,
        avatar: avatarValue ?? null,
        banque_id: finalBanqueId,
        actif,
        // Un admin de banque est initialisé avec l'accès à toutes les applis
        // de sa banque (marqueur pour ne pas ré-accorder après un décochage).
        ...(isNewBankAdmin ? { access_initialized: true } : {}),
      }
      users.push(newUser)
      await writeUsers(users)
      // Accès par défaut : toutes les applications de la banque pour un admin de banque.
      if (isNewBankAdmin) {
        await grantAllBankApps(newId, finalBanqueId as number)
      }
      // Notifie les admins de la banque qu'un utilisateur a été créé (hors créateur).
      if (finalBanqueId != null) {
        const bankAdmins = users
          .filter((u) => u.role === "admin" && u.banque_id === finalBanqueId && u.actif !== false && u.id !== me.id && u.id !== newId)
          .map((u) => u.id)
        await notifyMany(bankAdmins, {
          type: "bank_user_created",
          message: `Un nouvel utilisateur (${newUser.nom}) a été créé dans votre banque.`,
        })
      }
      const { mot_de_passe, ...safe } = newUser
      responseUser = safe
    }

    // Logger l'action
    await logUserAction(
      "Création utilisateur",
      responseUser.id,
      responseUser.nom,
      `Utilisateur créé: ${responseUser.nom} (${responseUser.email}) avec le rôle ${responseUser.role || "utilisateur"}`
    )

    // Retourner l'utilisateur sans le mot de passe
    return NextResponse.json(responseUser, { status: 201 })
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error)
    await logError(
      "Création utilisateur",
      "Erreur lors de la création d'un utilisateur",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
