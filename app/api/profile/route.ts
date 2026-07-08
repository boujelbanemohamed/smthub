import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { logUserAction, logError } from "@/lib/logger"
import { getCurrentUser as getAuthenticatedUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
  avatar?: string | null
}

// Valide la valeur d'avatar : image téléversée (/uploads/...), préréglage
// couleur (color:#rrggbb), ou photo intégrée en base64 (data:image/...).
// Tout le reste est ignoré (empêche d'injecter une URL externe arbitraire).
// La photo base64 est bornée en taille pour ne pas alourdir l'enregistrement.
function sanitizeAvatar(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== "string") return undefined
  if (value.startsWith("/uploads/")) return value
  if (/^color:#[0-9a-fA-F]{6}$/.test(value)) return value
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/.test(value) && value.length <= 400_000) return value
  return undefined
}

function usePostgres(): boolean {
  return process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
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
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // getCurrentUser lit déjà le magasin réel (fichier JSON ou PostgreSQL)
    // et vérifie que l'utilisateur existe encore. On complète avec l'avatar
    // (non porté par le jeton de session).
    let avatar: string | null = null
    if (usePostgres()) {
      const dbUser = await prisma.user.findUnique({ where: { id: currentUser.id }, select: { avatar: true } })
      avatar = dbUser?.avatar ?? null
    } else {
      const users = await readUsers()
      avatar = users.find((u) => u.id === currentUser.id)?.avatar ?? null
    }
    const safeUser = {
      id: currentUser.id,
      nom: currentUser.nom,
      email: currentUser.email,
      role: currentUser.role,
      avatar,
    }

    await logUserAction(
      "Consultation profil",
      currentUser.id,
      currentUser.nom,
      "Consultation des informations de profil"
    )
    return NextResponse.json(safeUser)
  } catch (error) {
    await logError(
      "Consultation profil",
      "Erreur lors de la lecture du profil",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { nom, email, currentPassword, newPassword, avatar } = await request.json()

    if (!nom || !email) {
      return NextResponse.json({ error: "Nom et email requis" }, { status: 400 })
    }

    const avatarValue = sanitizeAvatar(avatar)

    // Décrit précisément ce qui a été modifié (pour le journal d'activité).
    const changes: string[] = []
    if (nom && nom !== currentUser.nom) changes.push("nom")
    if (email && email !== currentUser.email) changes.push("email")
    if (newPassword) changes.push("mot de passe")
    if (avatarValue !== undefined) changes.push(avatarValue === null ? "photo de profil retirée" : "photo de profil")
    const changeDetails = changes.length ? `Modifications : ${changes.join(", ")}` : "Profil mis à jour"

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Le nouveau mot de passe doit contenir au moins 6 caractères" },
          { status: 400 }
        )
      }
    }

    const pg = usePostgres()

    // --- Mode PostgreSQL ---
    if (pg) {
      const dbUser = await prisma.user.findUnique({ where: { id: currentUser.id } })
      if (!dbUser) {
        return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
      }

      // Email déjà utilisé par un autre utilisateur ?
      const emailOwner = await prisma.user.findUnique({ where: { email } })
      if (emailOwner && emailOwner.id !== currentUser.id) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
      }

      const data: { nom: string; email: string; mot_de_passe?: string; avatar?: string | null } = { nom, email }

      if (newPassword) {
        const valid = await bcrypt.compare(currentPassword, dbUser.mot_de_passe || "")
        if (!valid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 })
        }
        data.mot_de_passe = await bcrypt.hash(newPassword, 10)
      }

      if (avatarValue !== undefined) {
        data.avatar = avatarValue
      }

      const updated = await prisma.user.update({
        where: { id: currentUser.id },
        data,
        select: { id: true, nom: true, email: true, role: true, avatar: true },
      })

      const response = NextResponse.json({
        success: true,
        user: updated,
        message: "Profil mis à jour avec succès",
      })
      const token = await signSession({
        id: updated.id,
        nom: updated.nom,
        email: updated.email,
        role: updated.role as "admin" | "utilisateur",
      })
      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
      })

      await logUserAction("Mise à jour profil", updated.id, updated.nom, changeDetails)
      return response
    }

    // --- Mode fichier JSON ---
    const users = await readUsers()
    const userIndex = users.findIndex((u) => u.id === currentUser.id)
    if (userIndex === -1) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    // Email déjà utilisé par un autre utilisateur ?
    const existingUser = users.find((u) => u.email === email && u.id !== currentUser.id)
    if (existingUser) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
    }

    if (newPassword) {
      const valid = await bcrypt.compare(currentPassword, users[userIndex].mot_de_passe || "")
      if (!valid) {
        return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 })
      }
      users[userIndex].mot_de_passe = await bcrypt.hash(newPassword, 10)
    }

    users[userIndex].nom = nom
    users[userIndex].email = email
    if (avatarValue !== undefined) {
      users[userIndex].avatar = avatarValue
    }
    await writeUsers(users)

    const updatedUserData = {
      id: users[userIndex].id,
      nom: users[userIndex].nom,
      email: users[userIndex].email,
      role: users[userIndex].role,
    }

    const { mot_de_passe, ...safeUser } = users[userIndex]
    const response = NextResponse.json({
      success: true,
      user: safeUser,
      message: "Profil mis à jour avec succès",
    })

    const token = await signSession(updatedUserData)
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    })

    await logUserAction(
      "Mise à jour profil",
      users[userIndex].id,
      users[userIndex].nom,
      changeDetails
    )
    return response
  } catch (error) {
    await logError(
      "Mise à jour profil",
      "Erreur lors de la mise à jour du profil",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 })
  }
}
