import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import nodemailer from "nodemailer"
import { logSmtpAction, logError } from "@/lib/logger"

// Vérification d'authentification admin
async function checkAdminAuth() {
  try {
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    
    if (session?.value) {
      const userData = JSON.parse(session.value)
      return userData.role === "admin"
    }
    return false
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }

    const smtpConfig = await request.json()
    
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
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    let adminName = "Administrateur"
    if (session?.value) {
      try {
        const userData = JSON.parse(session.value)
        adminName = userData.nom || "Administrateur"
      } catch {}
    }

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
      if (error.message.includes("Invalid login")) {
        errorMessage = "Erreur d'authentification : vérifiez votre nom d'utilisateur et mot de passe"
      } else if (error.message.includes("ECONNREFUSED")) {
        errorMessage = "Impossible de se connecter au serveur SMTP : vérifiez l'adresse et le port"
      } else if (error.message.includes("ENOTFOUND")) {
        errorMessage = "Serveur SMTP introuvable : vérifiez l'adresse du serveur"
      } else {
        errorMessage = `Erreur SMTP : ${error.message}`
      }
    }

    // Logger l'erreur
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    let adminName = "Administrateur"
    if (session?.value) {
      try {
        const userData = JSON.parse(session.value)
        adminName = userData.nom || "Administrateur"
      } catch {}
    }

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
