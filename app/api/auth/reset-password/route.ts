import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { peekResetToken, consumeResetToken } from "@/lib/password-reset"
import { setUserPassword } from "@/lib/user-store"
import { isValidPassword } from "@/lib/auth"
import { logUserAction, logError } from "@/lib/logger"
import { getSecurityConfig, evaluatePassword } from "@/lib/security-config"
import { isPasswordReused, recordPasswordChange } from "@/lib/password-security"
import { clearFailures } from "@/lib/login-attempts"

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

    // On doit connaître l'utilisateur cible AVANT d'appliquer la politique
    // (pour l'anti-réutilisation), mais SANS consommer le jeton en cas de
    // rejet → on l'inspecte d'abord (peek).
    const preview = await peekResetToken(token)
    if (!preview) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré. Veuillez refaire une demande." },
        { status: 400 }
      )
    }

    // Politique de sécurité (si activée par le super-admin) : complexité +
    // interdiction de réutilisation des N derniers mots de passe.
    const security = await getSecurityConfig()
    if (security.passwordPolicy.enabled) {
      const problems = evaluatePassword(password, security.passwordPolicy)
      if (problems.length > 0) {
        return NextResponse.json(
          { error: `Le mot de passe doit contenir ${problems.join(", ")}.` },
          { status: 400 }
        )
      }
      if (
        security.passwordPolicy.historyCount > 0 &&
        (await isPasswordReused(preview.userId, password))
      ) {
        return NextResponse.json(
          { error: "Ce mot de passe a déjà été utilisé récemment. Choisissez-en un autre." },
          { status: 400 }
        )
      }
    }

    // Consommation atomique (usage unique) APRÈS validation de la politique.
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

    // Met à jour les métadonnées de sécurité : réarme l'horloge d'expiration,
    // alimente l'historique anti-réutilisation, et lève tout verrouillage.
    await recordPasswordChange(entry.userId, hashed, security.passwordPolicy.historyCount)
    await clearFailures(entry.email)

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
