import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { peekResetToken, consumeResetToken } from "@/lib/password-reset"
import { setUserPassword } from "@/lib/user-store"
import { isValidPassword } from "@/lib/auth"
import { logUserAction, logError } from "@/lib/logger"

// GET /api/auth/reset-password?token=... → vérifie la validité du jeton.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") || ""
  const entry = await peekResetToken(token)
  if (!entry) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
  return NextResponse.json({ valid: true, email: entry.email })
}

// POST /api/auth/reset-password  { token, password } → applique le nouveau mot de passe.
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Jeton et mot de passe requis" }, { status: 400 })
    }

    const check = isValidPassword(password)
    if (!check.valid) {
      return NextResponse.json({ error: check.message }, { status: 400 })
    }

    // Consommation atomique (usage unique) AVANT modification.
    const entry = await consumeResetToken(token)
    if (!entry) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré. Veuillez refaire une demande." },
        { status: 400 }
      )
    }

    const hashed = await bcrypt.hash(password, 10)
    const ok = await setUserPassword(entry.userId, hashed)
    if (!ok) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    }

    await logUserAction("Réinitialisation mot de passe", entry.userId, entry.email, "Mot de passe redéfini via lien")
    return NextResponse.json({ success: true, message: "Mot de passe mis à jour avec succès." })
  } catch (error) {
    await logError(
      "Réinitialisation mot de passe",
      "Erreur lors de la réinitialisation",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    return NextResponse.json({ error: "Erreur lors de la réinitialisation" }, { status: 500 })
  }
}
