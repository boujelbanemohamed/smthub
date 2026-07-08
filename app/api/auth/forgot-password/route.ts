import { type NextRequest, NextResponse } from "next/server"
import { findUserByEmail } from "@/lib/user-store"
import { createResetToken } from "@/lib/password-reset"
import { sendEmail, generatePasswordResetEmail } from "@/lib/email-service"
import { checkRateLimit, isValidEmail } from "@/lib/auth"
import { logUserAction, logError } from "@/lib/logger"

// Message générique : ne révèle jamais si un compte existe (anti-énumération).
const GENERIC_MESSAGE =
  "Si un compte est associé à cet email, un lien de réinitialisation vient d'être envoyé."

function getOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const proto = request.headers.get("x-forwarded-proto") || "http"
  const host = request.headers.get("host") || "localhost:4000"
  return `${proto}://${host}`
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 })
    }

    // Limite les tentatives pour éviter l'abus / le spam d'emails.
    if (!checkRateLimit(`forgot:${ip}:${email}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429 }
      )
    }

    const user = await findUserByEmail(email)
    if (user) {
      const token = await createResetToken(user.id, user.email, 60)
      const resetUrl = `${getOrigin(request)}/reset-password?token=${token}`
      const sent = await sendEmail(generatePasswordResetEmail(user.nom, user.email, resetUrl))
      if (!sent) {
        // SMTP non configuré : on trace pour l'admin sans révéler quoi que ce soit au client.
        await logError(
          "Mot de passe oublié",
          `Lien généré pour ${user.email} mais email non envoyé (SMTP indisponible)`,
          "SMTP non configuré"
        )
        // Aide au développement : afficher le lien dans la console serveur tant que
        // le SMTP n'est pas configuré. JAMAIS en production (secret dans les logs).
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `\n[Mot de passe oublié] SMTP non configuré — lien de réinitialisation pour ${user.email} :\n  ${resetUrl}\n`
          )
        }
      } else {
        await logUserAction("Mot de passe oublié", user.id, user.nom, "Lien de réinitialisation envoyé")
      }
    }

    // Réponse identique que le compte existe ou non.
    return NextResponse.json({ message: GENERIC_MESSAGE })
  } catch (error) {
    await logError(
      "Mot de passe oublié",
      "Erreur lors de la demande de réinitialisation",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    // On reste générique même en cas d'erreur interne.
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }
}
