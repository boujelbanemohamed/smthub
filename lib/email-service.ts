import nodemailer from "nodemailer"
import { promises as fs } from "fs"
import path from "path"
import { generateEmailFromTemplate } from "./email-templates"

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from_name: string
  from_email: string
  enabled: boolean
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: { filename: string; content: string | Buffer; contentType?: string }[]
}

const SMTP_CONFIG_FILE = path.join(process.cwd(), "data", "smtp-config.json")

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const data = await fs.readFile(SMTP_CONFIG_FILE, "utf-8")
    const config = JSON.parse(data)
    // Le mot de passe (secret) peut être fourni via variable d'environnement
    // plutôt que stocké en clair dans le fichier de configuration.
    if (process.env.SMTP_PASS) config.password = process.env.SMTP_PASS
    // Config considérée active sauf désactivation explicite (enabled === false).
    // Une config sans hôte/utilisateur n'est pas exploitable.
    if (config.enabled === false || !config.host || !config.user) return null
    return config
  } catch {
    return null
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000"
}

/** Gabarit générique pour les emails « à action » (bouton + lien). */
function buildActionEmail(params: {
  to: string
  subject: string
  heading: string
  intro: string
  buttonLabel: string
  url: string
  note?: string
}): EmailOptions {
  const { to, subject, heading, intro, buttonLabel, url, note } = params
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1877f2 0%, #166fe5 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Monétique Tunisie</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1877f2; margin-top: 0;">${heading}</h2>
        <p style="color: #475569; line-height: 1.6;">${intro}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background: #1877f2; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            ${buttonLabel}
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${url}" style="color: #1877f2; word-break: break-all;">${url}</a>
        </p>
        ${note ? `<p style="color: #92400e; font-size: 13px; background: #fef3c7; padding: 12px; border-radius: 6px;">${note}</p>` : ""}
      </div>
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">Monétique Tunisie - Portail d'applications centralisé<br><em>Ce message a été généré automatiquement.</em></p>
      </div>
    </div>
  `
  const text = `${heading}

${intro}

${buttonLabel} : ${url}
${note ? `\n${note}\n` : ""}
Monétique Tunisie - Portail d'applications centralisé
Ce message a été généré automatiquement.`
  return { to, subject, html, text }
}

/** Email de réinitialisation de mot de passe (mot de passe oublié). */
export function generatePasswordResetEmail(userName: string, userEmail: string, resetUrl: string): EmailOptions {
  return buildActionEmail({
    to: userEmail,
    subject: "🔑 Réinitialisation de votre mot de passe - Monétique Tunisie",
    heading: `Bonjour ${userName},`,
    intro:
      "Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    buttonLabel: "Réinitialiser mon mot de passe",
    url: resetUrl,
    note: "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
  })
}

/** Email envoyé à la création d'un compte : lien de définition du mot de passe (pas de mot de passe en clair). */
export function generateSetPasswordEmail(userName: string, userEmail: string, setUrl: string): EmailOptions {
  return buildActionEmail({
    to: userEmail,
    subject: "🎉 Bienvenue sur Monétique Tunisie - Activez votre compte",
    heading: `Bienvenue ${userName} !`,
    intro:
      "Votre compte a été créé sur le portail Monétique Tunisie. Pour des raisons de sécurité, définissez vous-même votre mot de passe en cliquant sur le bouton ci-dessous.",
    buttonLabel: "Définir mon mot de passe",
    url: setUrl,
    note: "Ce lien est valable 24 heures. Aucun mot de passe n'est transmis par email.",
  })
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const config = await getSmtpConfig()
    
    if (!config) {
      console.log("SMTP non configuré ou désactivé, email non envoyé")
      return false
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    })

    // Send email
    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    })

    console.log(`Email envoyé avec succès à ${options.to}`)
    return true
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error)
    return false
  }
}

export async function generateWelcomeEmail(userName: string, userEmail: string): Promise<EmailOptions> {
  const emailContent = await generateEmailFromTemplate("welcome", {
    userName,
    userEmail
  })

  if (!emailContent) {
    // Fallback si le template n'existe pas
    return {
      to: userEmail,
      subject: "🎉 Bienvenue sur SMT HUB - Votre compte est activé",
      html: `<p>Bonjour ${userName}, bienvenue sur SMT HUB !</p>`,
      text: `Bonjour ${userName}, bienvenue sur SMT HUB !`
    }
  }

  return {
    to: userEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  }
}

export function generateProfileUpdateEmail(userName: string, userEmail: string, changes: string[]): EmailOptions {
  const changesList = changes.map(change => `<li style="margin: 5px 0;">${change}</li>`).join("")
  const changesText = changes.map(change => `- ${change}`).join("\n")

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">SMT HUB</h1>
        <p style="color: #e0f2fe; margin: 10px 0 0 0;">Notification de mise à jour de profil</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e40af; margin-top: 0;">Bonjour ${userName},</h2>
        <p style="color: #475569; line-height: 1.6;">
          Votre profil SMT HUB a été mis à jour avec succès.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #059669; margin-top: 0;">✅ Modifications effectuées :</h3>
          <ul style="color: #475569; margin: 10px 0; padding-left: 20px;">
            ${changesList}
          </ul>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>🔒 Sécurité :</strong> Si vous n'êtes pas à l'origine de ces modifications, 
            contactez immédiatement votre administrateur.
          </p>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
          Date de modification : ${new Date().toLocaleString('fr-FR')}
        </p>
      </div>
      
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">
          SMT HUB - Portail d'applications centralisé<br>
          <em>Ce message a été généré automatiquement.</em>
        </p>
      </div>
    </div>
  `

  const text = `
SMT HUB - Notification de mise à jour de profil

Bonjour ${userName},

Votre profil SMT HUB a été mis à jour avec succès.

Modifications effectuées :
${changesText}

🔒 Sécurité : Si vous n'êtes pas à l'origine de ces modifications, contactez immédiatement votre administrateur.

Date de modification : ${new Date().toLocaleString('fr-FR')}

SMT HUB - Portail d'applications centralisé
Ce message a été généré automatiquement.
  `

  return {
    to: userEmail,
    subject: "🔄 SMT HUB - Votre profil a été mis à jour",
    html,
    text
  }
}

export function generateAccessChangeEmail(
  userName: string,
  userEmail: string,
  appName: string,
  action: "granted" | "revoked" | "modified",
  oldLevel?: string,
  newLevel?: string,
  adminName?: string
): EmailOptions {
  const getActionTitle = () => {
    switch (action) {
      case "granted":
        return "🎉 Nouvel accès accordé"
      case "revoked":
        return "🔒 Accès retiré"
      case "modified":
        return "🔄 Accès modifié"
      default:
        return "📋 Modification d'accès"
    }
  }

  const getActionDescription = () => {
    switch (action) {
      case "granted":
        return `Vous avez maintenant accès à l'application <strong>${appName}</strong> avec le niveau <strong>${newLevel}</strong>.`
      case "revoked":
        return `Votre accès à l'application <strong>${appName}</strong> a été retiré.`
      case "modified":
        return `Votre niveau d'accès à l'application <strong>${appName}</strong> a été modifié de <strong>${oldLevel}</strong> vers <strong>${newLevel}</strong>.`
      default:
        return `Votre accès à l'application <strong>${appName}</strong> a été modifié.`
    }
  }

  const getLevelDescription = (level: string) => {
    switch (level) {
      case "read":
        return "Lecture seule - Vous pouvez consulter mais pas modifier"
      case "write":
        return "Lecture/Écriture - Vous pouvez consulter et modifier"
      case "admin":
        return "Administrateur - Vous avez tous les droits sur l'application"
      default:
        return level
    }
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">SMT HUB</h1>
        <p style="color: #e0f2fe; margin: 10px 0 0 0;">Notification de modification d'accès</p>
      </div>

      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e40af; margin-top: 0;">${getActionTitle()}</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 16px;">
          Bonjour <strong>${userName}</strong>,
        </p>
        <p style="color: #475569; line-height: 1.6;">
          ${getActionDescription()}
        </p>

        <div style="background: white; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">📱 Détails de l'application</h3>
          <div style="color: #475569; margin: 15px 0;">
            <strong>Application :</strong> ${appName}<br>
            ${newLevel && newLevel !== "none" ? `<strong>Niveau d'accès :</strong> ${getLevelDescription(newLevel)}<br>` : ""}
            ${adminName ? `<strong>Modifié par :</strong> ${adminName}<br>` : ""}
            <strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}
          </div>
        </div>

        ${action === "granted" ? `
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bbf7d0;">
          <h4 style="color: #166534; margin-top: 0;">🚀 Prochaines étapes :</h4>
          <ul style="color: #166534; margin: 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Connectez-vous à votre portail SMT HUB</li>
            <li style="margin: 8px 0;">L'application ${appName} est maintenant disponible</li>
            <li style="margin: 8px 0;">Explorez les fonctionnalités selon votre niveau d'accès</li>
          </ul>
        </div>
        ` : ""}

        ${action === "revoked" ? `
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #fecaca;">
          <p style="color: #dc2626; margin: 0; font-size: 14px;">
            <strong>⚠️ Important :</strong> Vous ne pourrez plus accéder à cette application.
            Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.
          </p>
        </div>
        ` : ""}

        <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 30px;">
          Si vous avez des questions concernant cette modification, n'hésitez pas à contacter votre équipe support.
        </p>
      </div>

      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">
          SMT HUB - Portail d'applications centralisé<br>
          <em>Ce message a été généré automatiquement.</em>
        </p>
      </div>
    </div>
  `

  const text = `
SMT HUB - ${getActionTitle()}

Bonjour ${userName},

${getActionDescription().replace(/<[^>]*>/g, '')}

Détails de l'application :
- Application : ${appName}
${newLevel && newLevel !== "none" ? `- Niveau d'accès : ${getLevelDescription(newLevel)}` : ""}
${adminName ? `- Modifié par : ${adminName}` : ""}
- Date : ${new Date().toLocaleString('fr-FR')}

${action === "granted" ? `
Prochaines étapes :
- Connectez-vous à votre portail SMT HUB
- L'application ${appName} est maintenant disponible
- Explorez les fonctionnalités selon votre niveau d'accès
` : ""}

${action === "revoked" ? `
⚠️ Important : Vous ne pourrez plus accéder à cette application.
Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.
` : ""}

Si vous avez des questions concernant cette modification, n'hésitez pas à contacter votre équipe support.

SMT HUB - Portail d'applications centralisé
Ce message a été généré automatiquement.
  `

  return {
    to: userEmail,
    subject: `${getActionTitle()} - ${appName} | SMT HUB`,
    html,
    text
  }
}
