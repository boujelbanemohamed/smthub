import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { logUserAction, logError } from "@/lib/logger"

// Données simulées pour les utilisateurs (partagées avec les autres APIs)
const mockUsers = [
  { id: 1, nom: "Admin User", email: "admin@smt.com", role: "admin" },
  { id: 2, nom: "John Doe", email: "user@smt.com", role: "utilisateur" },
  { id: 3, nom: "Jane Smith", email: "jane@smt.com", role: "utilisateur" },
  { id: 4, nom: "Bob Wilson", email: "bob@smt.com", role: "utilisateur" }
]

let users = [...mockUsers]

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
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

    // Retourner les informations de l'utilisateur actuel
    const user = users.find(u => u.id === currentUser.id)
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    await logUserAction("Consultation profil", user.id, user.nom, "Consultation des informations de profil")
    return NextResponse.json(user)
  } catch (error) {
    await logError("Consultation profil", "Erreur lors de la lecture du profil", error instanceof Error ? error.message : "Erreur inconnue")
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const updateData = await request.json()
    const { nom, email, currentPassword, newPassword } = updateData

    // Validation basique
    if (!nom || !email) {
      return NextResponse.json({ error: "Nom et email requis" }, { status: 400 })
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    const existingUser = users.find(u => u.email === email && u.id !== currentUser.id)
    if (existingUser) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
    }

    // Trouver l'utilisateur à mettre à jour
    const userIndex = users.findIndex(u => u.id === currentUser.id)
    if (userIndex === -1) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    // Si changement de mot de passe demandé
    if (newPassword) {
      // Dans un vrai système, on vérifierait le mot de passe actuel
      // Ici on simule juste la validation
      if (!currentPassword) {
        return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 })
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" }, { status: 400 })
      }

      // Dans un vrai système, on hasherait le nouveau mot de passe
      console.log(`Mot de passe changé pour l'utilisateur ${currentUser.id}`)
    }

    // Mettre à jour l'utilisateur
    users[userIndex] = {
      ...users[userIndex],
      nom,
      email
    }

    // Mettre à jour la session
    const cookieStore = cookies()
    const updatedUserData = {
      id: users[userIndex].id,
      nom: users[userIndex].nom,
      email: users[userIndex].email,
      role: users[userIndex].role
    }

    // Créer un nouveau cookie de session avec les données mises à jour
    const response = NextResponse.json({
      success: true,
      user: users[userIndex],
      message: "Profil mis à jour avec succès"
    })

    response.cookies.set("user-session", JSON.stringify(updatedUserData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    })

    await logUserAction("Mise à jour profil", users[userIndex].id, users[userIndex].nom, "Profil mis à jour")
    return response
  } catch (error) {
    await logError("Mise à jour profil", "Erreur lors de la mise à jour du profil", error instanceof Error ? error.message : "Erreur inconnue")
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 })
  }
}
