import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { logSmtpAction, logError } from "@/lib/logger"
import { getCurrentUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  let smtpConfig: any
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }

    smtpConfig = await request.json()

    // Validation des données requises
    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.password) {
      await logError(
        "Test SMTP",
        `Tentative de test avec configuration incomplète: ${JSON.stringify(smtpConfig)}`,
        "Configuration SMTP incomplète"
      )
      return NextResponse.json({ 
        error: "Configuration SMTP incomplète" 
      }, { status: 400 })
    }

    // Logger l'action (on récupère l'admin depuis la session)
    const adminName = currentUser.nom || "Administrateur"

    await logSmtpAction(
      "Test SMTP",
      0, // ID admin par défaut
      adminName,
      `Test SMTP initié: ${smtpConfig.host}:${smtpConfig.port} (${smtpConfig.user})`
    )

    // Créer le transporteur SMTP
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port),
      secure: smtpConfig.secure, // true pour 465, false pour autres ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    })

    // Vérifier la connexion
    await transporter.verify()

    // Envoyer un email de test
    const testEmail = {
      from: `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.user}>`,
      to: smtpConfig.user, // Envoyer à l'utilisateur configuré
      subject: "Test de configuration SMTP - SMT HUB",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1877f2;">Test de configuration SMTP réussi !</h2>
          <p>Félicitations ! Votre configuration SMTP fonctionne correctement.</p>
          <div style="background-color: #f0f2f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1c1e21;">Paramètres testés :</h3>
            <ul style="color: #65676b;">
              <li><strong>Serveur :</strong> ${smtpConfig.host}</li>
              <li><strong>Port :</strong> ${smtpConfig.port}</li>
              <li><strong>Sécurité :</strong> ${smtpConfig.secure ? 'SSL/TLS activé' : 'STARTTLS'}</li>
              <li><strong>Utilisateur :</strong> ${smtpConfig.user}</li>
            </ul>
          </div>
          <p style="color: #65676b;">
            Les emails automatiques de SMT HUB peuvent maintenant être envoyés aux utilisateurs.
          </p>
          <hr style="border: none; border-top: 1px solid #dadde1; margin: 20px 0;">
          <p style="color: #8a8d91; font-size: 12px;">
            Cet email a été envoyé automatiquement par SMT HUB pour tester la configuration SMTP.
          </p>
        </div>
      `
    }

    await transporter.sendMail(testEmail)

    // Logger le succès
    await logSmtpAction(
      "Test SMTP",
      0, // ID admin par défaut
      adminName,
      `Test SMTP réussi: Email envoyé à ${smtpConfig.user}`,
      "SUCCESS"
    )

    return NextResponse.json({ 
      message: "Email de test envoyé avec succès !",
      details: `Email envoyé à ${smtpConfig.user}`
    })

  } catch (error) {
    console.error("Erreur lors du test SMTP:", error)
    
    let errorMessage = "Erreur lors du test de la configuration SMTP"
    if (error instanceof Error) {
      const msg = error.message
      const code = (error as any).code as string | undefined
      if (msg.includes("Invalid login") || msg.includes("535") || msg.includes("Username and Password not accepted")) {
        errorMessage =
          "Authentification refusée : nom d'utilisateur ou mot de passe incorrect. " +
          "Pour Gmail/Outlook avec 2FA, utilisez un « mot de passe d'application », pas votre mot de passe habituel."
      } else if (msg.includes("534") || msg.includes("application-specific password") || msg.includes("BadCredentials")) {
        errorMessage =
          "Google exige un « mot de passe d'application » : activez la validation en 2 étapes puis générez-en un sur myaccount.google.com/apppasswords."
      } else if (code === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
        errorMessage = "Connexion refusée : vérifiez l'adresse du serveur et le port (587 STARTTLS, 465 SSL/TLS)."
      } else if (code === "ETIMEDOUT" || msg.includes("ETIMEDOUT") || msg.includes("timeout") || msg.includes("Greeting never received")) {
        errorMessage = "Délai dépassé : le serveur ne répond pas. Vérifiez le port et qu'aucun pare-feu ne bloque le SMTP sortant."
      } else if (code === "ENOTFOUND" || msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN")) {
        errorMessage = "Serveur SMTP introuvable : vérifiez l'adresse du serveur (ex: smtp.gmail.com)."
      } else if (code === "ESOCKET" || msg.includes("wrong version number") || msg.includes("SSL")) {
        errorMessage =
          "Erreur SSL/TLS : incohérence port/chiffrement. Utilisez le port 465 avec SSL/TLS coché, OU le port 587 avec SSL/TLS décoché (STARTTLS)."
      } else if (msg.includes("Missing credentials") || msg.includes("No auth")) {
        errorMessage = "Identifiants manquants : renseignez le nom d'utilisateur et le mot de passe SMTP."
      } else {
        errorMessage = `Erreur SMTP : ${msg}`
      }
    }

    // Logger l'erreur
    const adminName = "Administrateur"

    await logError(
      "Test SMTP",
      `Test SMTP échoué: ${smtpConfig?.host}:${smtpConfig?.port}`,
      errorMessage,
      0, // ID admin par défaut
      adminName
    )
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
