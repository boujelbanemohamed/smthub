import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import nodemailer from "nodemailer"

interface SmtpTestConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from_name: string
  from_email: string
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const config: SmtpTestConfig = await request.json()
    const { host, port, secure, user, password, from_name, from_email } = config

    // Validation
    if (!host || !user || !password || !from_email) {
      return NextResponse.json({ 
        error: "Tous les champs sont requis pour le test" 
      }, { status: 400 })
    }

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: host,
      port: port,
      secure: secure, // true for 465, false for other ports
      auth: {
        user: user,
        pass: password,
      },
      // Add timeout
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    })

    // Verify connection
    await transporter.verify()

    // Send test email
    const testEmailOptions = {
      from: `"${from_name}" <${from_email}>`,
      to: user, // Send test email to the configured user
      subject: "Test de configuration SMTP - SMT HUB",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">SMT HUB</h1>
            <p style="color: #e0f2fe; margin: 10px 0 0 0;">Test de configuration SMTP</p>
          </div>
          
          <div style="padding: 30px; background: #f8fafc; border-left: 4px solid #3b82f6;">
            <h2 style="color: #1e40af; margin-top: 0;">✅ Configuration SMTP fonctionnelle</h2>
            <p style="color: #475569; line-height: 1.6;">
              Ce message confirme que votre configuration SMTP est correcte et que les emails 
              peuvent être envoyés depuis SMT HUB.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e40af; margin-top: 0;">Paramètres testés :</h3>
              <ul style="color: #475569; margin: 0;">
                <li><strong>Serveur :</strong> ${host}:${port}</li>
                <li><strong>Sécurité :</strong> ${secure ? 'SSL/TLS activé' : 'Non sécurisé'}</li>
                <li><strong>Utilisateur :</strong> ${user}</li>
                <li><strong>Expéditeur :</strong> ${from_name} &lt;${from_email}&gt;</li>
              </ul>
            </div>
            
            <p style="color: #475569; font-size: 14px; margin-bottom: 0;">
              <em>Ce message a été généré automatiquement lors du test de configuration SMTP.</em>
            </p>
          </div>
          
          <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
            <p style="margin: 0; font-size: 14px;">
              SMT HUB - Portail d'applications centralisé
            </p>
          </div>
        </div>
      `,
      text: `
SMT HUB - Test de configuration SMTP

✅ Configuration SMTP fonctionnelle

Ce message confirme que votre configuration SMTP est correcte et que les emails peuvent être envoyés depuis SMT HUB.

Paramètres testés :
- Serveur : ${host}:${port}
- Sécurité : ${secure ? 'SSL/TLS activé' : 'Non sécurisé'}
- Utilisateur : ${user}
- Expéditeur : ${from_name} <${from_email}>

Ce message a été généré automatiquement lors du test de configuration SMTP.

SMT HUB - Portail d'applications centralisé
      `
    }

    await transporter.sendMail(testEmailOptions)

    return NextResponse.json({ 
      success: true, 
      message: "Test de connexion SMTP réussi ! Un email de test a été envoyé." 
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    
    console.error("Erreur lors du test SMTP:", error)
    
    // Provide more specific error messages
    let errorMessage = "Échec du test de connexion SMTP"
    if (error instanceof Error) {
      if (error.message.includes("EAUTH")) {
        errorMessage = "Erreur d'authentification. Vérifiez vos identifiants."
      } else if (error.message.includes("ECONNECTION") || error.message.includes("ETIMEDOUT")) {
        errorMessage = "Impossible de se connecter au serveur SMTP. Vérifiez l'adresse et le port."
      } else if (error.message.includes("EENVELOPE")) {
        errorMessage = "Erreur d'adresse email. Vérifiez l'email de l'expéditeur."
      } else {
        errorMessage = `Erreur SMTP: ${error.message}`
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
