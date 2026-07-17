import { promises as fs } from "fs"
import path from "path"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  html: string
  text: string
  variables: string[]
  description: string
  category: "welcome" | "profile" | "access" | "system"
}

interface EmailTemplateConfig {
  templates: EmailTemplate[]
  settings: {
    companyName: string
    supportEmail: string
    websiteUrl: string
    logoUrl: string
    primaryColor: string
    secondaryColor: string
  }
}

const TEMPLATES_FILE = path.join(process.cwd(), "data", "email-templates.json")

// Templates par défaut
const defaultTemplates: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Email de bienvenue",
    subject: "🎉 Bienvenue sur {{companyName}} - Votre compte est activé",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 32px;">{{companyName}}</h1>
        <p style="color: #e0f2fe; margin: 10px 0 0 0; font-size: 18px;">Bienvenue dans votre portail d'applications</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: {{primaryColor}}; margin-top: 0;">Bonjour {{userName}} ! 👋</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 16px;">
          Nous sommes ravis de vous accueillir sur <strong>{{companyName}}</strong>, votre portail centralisé 
          pour accéder à toutes vos applications professionnelles.
        </p>
        
        <div style="background: white; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid {{secondaryColor}}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: {{primaryColor}}; margin-top: 0; font-size: 18px;">🚀 Votre compte est prêt !</h3>
          <p style="color: #475569; margin: 15px 0;">
            <strong>Email :</strong> {{userEmail}}<br>
            <strong>Statut :</strong> Compte activé
          </p>
          <p style="color: #475569; line-height: 1.6;">
            Vous pouvez maintenant vous connecter et découvrir toutes les applications 
            auxquelles vous avez accès.
          </p>
        </div>
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bfdbfe;">
          <h4 style="color: {{primaryColor}}; margin-top: 0;">📋 Prochaines étapes :</h4>
          <ul style="color: #475569; margin: 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Connectez-vous à votre portail {{companyName}}</li>
            <li style="margin: 8px 0;">Explorez les applications disponibles</li>
            <li style="margin: 8px 0;">Personnalisez votre profil si nécessaire</li>
            <li style="margin: 8px 0;">Contactez votre administrateur pour toute question</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{websiteUrl}}" style="background: {{secondaryColor}}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Accéder au portail
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 30px;">
          Si vous avez des questions ou besoin d'aide, n'hésitez pas à contacter votre équipe support à {{supportEmail}}.
        </p>
      </div>
      
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">
          {{companyName}} - Portail d'applications centralisé<br>
          <em>Ce message a été généré automatiquement.</em>
        </p>
      </div>
    </div>
    `,
    text: `
{{companyName}} - Bienvenue !

Bonjour {{userName}} !

Nous sommes ravis de vous accueillir sur {{companyName}}, votre portail centralisé pour accéder à toutes vos applications professionnelles.

Votre compte est prêt !
- Email : {{userEmail}}
- Statut : Compte activé

Vous pouvez maintenant vous connecter et découvrir toutes les applications auxquelles vous avez accès.

Prochaines étapes :
- Connectez-vous à votre portail {{companyName}}
- Explorez les applications disponibles
- Personnalisez votre profil si nécessaire
- Contactez votre administrateur pour toute question

Si vous avez des questions ou besoin d'aide, n'hésitez pas à contacter votre équipe support à {{supportEmail}}.

{{companyName}} - Portail d'applications centralisé
Ce message a été généré automatiquement.
    `,
    variables: ["userName", "userEmail", "companyName", "supportEmail", "websiteUrl", "primaryColor", "secondaryColor"],
    description: "Email envoyé lors de la création d'un nouveau compte utilisateur",
    category: "welcome"
  },
  {
    id: "profile-update",
    name: "Notification de mise à jour de profil",
    subject: "🔄 {{companyName}} - Votre profil a été mis à jour",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{{companyName}}</h1>
        <p style="color: #e0f2fe; margin: 10px 0 0 0;">Notification de mise à jour de profil</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: {{primaryColor}}; margin-top: 0;">Bonjour {{userName}},</h2>
        <p style="color: #475569; line-height: 1.6;">
          Votre profil {{companyName}} a été mis à jour avec succès.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #059669; margin-top: 0;">✅ Modifications effectuées :</h3>
          <ul style="color: #475569; margin: 10px 0; padding-left: 20px;">
            {{changesList}}
          </ul>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>🔒 Sécurité :</strong> Si vous n'êtes pas à l'origine de ces modifications, 
            contactez immédiatement votre administrateur à {{supportEmail}}.
          </p>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
          Date de modification : {{modificationDate}}
        </p>
      </div>
      
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">
          {{companyName}} - Portail d'applications centralisé<br>
          <em>Ce message a été généré automatiquement.</em>
        </p>
      </div>
    </div>
    `,
    text: `
{{companyName}} - Notification de mise à jour de profil

Bonjour {{userName}},

Votre profil {{companyName}} a été mis à jour avec succès.

Modifications effectuées :
{{changesText}}

🔒 Sécurité : Si vous n'êtes pas à l'origine de ces modifications, contactez immédiatement votre administrateur à {{supportEmail}}.

Date de modification : {{modificationDate}}

{{companyName}} - Portail d'applications centralisé
Ce message a été généré automatiquement.
    `,
    variables: ["userName", "companyName", "changesList", "changesText", "supportEmail", "modificationDate"],
    description: "Email envoyé lors de la modification du profil utilisateur",
    category: "profile"
  },
  {
    id: "access-granted",
    name: "Nouvel accès accordé",
    subject: "🎉 Nouvel accès accordé - {{appName}} | {{companyName}}",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{{companyName}}</h1>
        <p style="color: #e0f2fe; margin: 10px 0 0 0;">Notification de modification d'accès</p>
      </div>

      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: {{primaryColor}}; margin-top: 0;">🎉 Nouvel accès accordé</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 16px;">
          Bonjour <strong>{{userName}}</strong>,
        </p>
        <p style="color: #475569; line-height: 1.6;">
          Vous avez maintenant accès à l'application <strong>{{appName}}</strong> avec le niveau <strong>{{accessLevel}}</strong>.
        </p>

        <div style="background: white; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid {{secondaryColor}}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: {{primaryColor}}; margin-top: 0; font-size: 18px;">📱 Détails de l'application</h3>
          <div style="color: #475569; margin: 15px 0;">
                         <strong>Application :</strong> {{appName}}<br>
             <strong>Niveau d'accès :</strong> {{accessLevelDescription}}<br>
             <strong>Accordé par :</strong> {{adminName}}<br>
             <strong>Date :</strong> {{accessDate}}
          </div>
        </div>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bbf7d0;">
          <h4 style="color: #166534; margin-top: 0;">🚀 Prochaines étapes :</h4>
          <ul style="color: #166534; margin: 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Connectez-vous à votre portail {{companyName}}</li>
            <li style="margin: 8px 0;">L'application {{appName}} est maintenant disponible</li>
            <li style="margin: 8px 0;">Explorez les fonctionnalités selon votre niveau d'accès</li>
          </ul>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 30px;">
          Si vous avez des questions concernant cette modification, n'hésitez pas à contacter votre équipe support à {{supportEmail}}.
        </p>
      </div>

      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">
          {{companyName}} - Portail d'applications centralisé<br>
          <em>Ce message a été généré automatiquement.</em>
        </p>
      </div>
    </div>
    `,
    text: `
{{companyName}} - Nouvel accès accordé

Bonjour {{userName}},

Vous avez maintenant accès à l'application {{appName}} avec le niveau {{accessLevel}}.

Détails de l'application :
- Application : {{appName}}
- Niveau d'accès : {{accessLevelDescription}}
- Accordé par : {{adminName}}
- Date : {{accessDate}}

Prochaines étapes :
- Connectez-vous à votre portail {{companyName}}
- L'application {{appName}} est maintenant disponible
- Explorez les fonctionnalités selon votre niveau d'accès

Si vous avez des questions concernant cette modification, n'hésitez pas à contacter votre équipe support à {{supportEmail}}.

{{companyName}} - Portail d'applications centralisé
Ce message a été généré automatiquement.
    `,
    variables: ["userName", "appName", "accessLevel", "accessLevelDescription", "adminName", "accessDate", "companyName", "supportEmail"],
    description: "Email envoyé lors de l'attribution d'un nouvel accès",
    category: "access"
  },
  {
    id: "access-revoked",
    name: "Accès retiré",
    subject: "🔒 Accès retiré - {{appName}} | {{companyName}}",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{{companyName}}</h1>
        <p style="color: #e0f2fe; margin: 10px 0 0 0;">Notification de modification d'accès</p>
      </div>

      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: {{primaryColor}}; margin-top: 0;">🔒 Accès retiré</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 16px;">
          Bonjour <strong>{{userName}}</strong>,
        </p>
        <p style="color: #475569; line-height: 1.6;">
          Votre accès à l'application <strong>{{appName}}</strong> a été retiré.
        </p>

        <div style="background: white; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #dc2626; margin-top: 0; font-size: 18px;">📱 Détails de l'application</h3>
          <div style="color: #475569; margin: 15px 0;">
                         <strong>Application :</strong> {{appName}}<br>
             <strong>Retiré par :</strong> {{adminName}}<br>
             <strong>Date :</strong> {{accessDate}}
          </div>
        </div>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #fecaca;">
          <p style="color: #dc2626; margin: 0; font-size: 14px;">
            <strong>⚠️ Important :</strong> Vous ne pourrez plus accéder à cette application.
            Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur à {{supportEmail}}.
          </p>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 30px;">
          Si vous avez des questions concernant cette modification, n'hésitez pas à contacter votre équipe support à {{supportEmail}}.
        </p>
      </div>

      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 14px;">
          {{companyName}} - Portail d'applications centralisé<br>
          <em>Ce message a été généré automatiquement.</em>
        </p>
      </div>
    </div>
    `,
    text: `
{{companyName}} - Accès retiré

Bonjour {{userName}},

Votre accès à l'application {{appName}} a été retiré.

Détails de l'application :
- Application : {{appName}}
- Retiré par : {{adminName}}
- Date : {{accessDate}}

⚠️ Important : Vous ne pourrez plus accéder à cette application.
Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur à {{supportEmail}}.

Si vous avez des questions concernant cette modification, n'hésitez pas à contacter votre équipe support à {{supportEmail}}.

{{companyName}} - Portail d'applications centralisé
Ce message a été généré automatiquement.
    `,
    variables: ["userName", "appName", "adminName", "accessDate", "companyName", "supportEmail"],
    description: "Email envoyé lors du retrait d'un accès",
    category: "access"
  },
  {
    id: "report",
    name: "Rapport de statistiques (planifié)",
    subject: "📊 {{titre}} - {{companyName}}",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">{{companyName}}</h1>
      </div>
      <div style="padding: 24px; background: #f8fafc;">
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{titre}}</h2>
        <p style="color: #475569;">Bonjour {{userName}},</p>
        <p style="color: #475569; line-height: 1.6;">
          Veuillez trouver ci-joint le rapport de statistiques d'usage de la banque <strong>{{banque}}</strong> pour la période <strong>{{periode}}</strong>.
        </p>
        <p style="color: #475569;">Total d'ouvertures sur la période : <strong>{{total}}</strong>.</p>
        <p style="color: #64748b; font-size: 13px;">Le détail complet est dans le fichier Excel joint (applications, utilisateurs, catégories, heures de pointe, applications non utilisées).</p>
      </div>
      <div style="padding: 16px; text-align: center; background: #1e293b; color: #94a3b8;">
        <p style="margin: 0; font-size: 13px;">{{companyName}} - Rapport généré automatiquement.</p>
      </div>
    </div>
    `,
    text: `{{companyName}} - {{titre}}

Bonjour {{userName}},

Veuillez trouver ci-joint le rapport de statistiques d'usage de la banque {{banque}} pour la période {{periode}}.
Total d'ouvertures sur la période : {{total}}.

Le détail complet est dans le fichier Excel joint.

{{companyName}} - Rapport généré automatiquement.`,
    variables: ["userName", "titre", "periode", "total", "banque", "companyName"],
    description: "Email d'accompagnement des rapports de statistiques envoyés automatiquement (le fichier Excel est joint).",
    category: "system"
  }
]

const defaultSettings = {
  companyName: "SMT HUB",
  supportEmail: "support@smt.com",
  websiteUrl: "http://localhost:4000",
  logoUrl: "",
  primaryColor: "#1e40af",
  secondaryColor: "#3b82f6"
}

// Fonctions pour gérer les templates
export async function getEmailTemplates(): Promise<EmailTemplateConfig> {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, "utf-8")
    const config: EmailTemplateConfig = JSON.parse(data)
    // Fusion des modèles par défaut manquants (ex. nouveau modèle « report »
    // ajouté après coup) : on ajoute ceux dont l'id n'existe pas encore, sans
    // écraser les personnalisations des modèles déjà présents.
    const existingIds = new Set((config.templates || []).map((t) => t.id))
    const missing = defaultTemplates.filter((t) => !existingIds.has(t.id))
    if (missing.length > 0) {
      config.templates = [...(config.templates || []), ...missing]
      await saveEmailTemplates(config)
    }
    return config
  } catch {
    // Retourner les templates par défaut si le fichier n'existe pas
    const defaultConfig: EmailTemplateConfig = {
      templates: defaultTemplates,
      settings: defaultSettings
    }
    await saveEmailTemplates(defaultConfig)
    return defaultConfig
  }
}

export async function saveEmailTemplates(config: EmailTemplateConfig): Promise<void> {
  const dataDir = path.dirname(TEMPLATES_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(config, null, 2))
}

export async function getTemplateById(id: string): Promise<EmailTemplate | null> {
  const config = await getEmailTemplates()
  return config.templates.find(template => template.id === id) || null
}

export async function updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<void> {
  const config = await getEmailTemplates()
  const templateIndex = config.templates.findIndex(template => template.id === id)
  
  if (templateIndex !== -1) {
    config.templates[templateIndex] = { ...config.templates[templateIndex], ...updates }
    await saveEmailTemplates(config)
  }
}

export async function updateSettings(settings: Partial<EmailTemplateConfig['settings']>): Promise<void> {
  const config = await getEmailTemplates()
  config.settings = { ...config.settings, ...settings }
  await saveEmailTemplates(config)
}

// Fonction pour remplacer les variables dans un template
export function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    // Si la valeur est vide ou undefined, on la remplace par une chaîne vide
    const replacementValue = value || ""
    result = result.replace(regex, replacementValue)
  }
  
  return result
}

// Fonction pour générer un email à partir d'un template
export async function generateEmailFromTemplate(
  templateId: string, 
  variables: Record<string, string>
): Promise<{ subject: string; html: string; text: string } | null> {
  const template = await getTemplateById(templateId)
  if (!template) return null
  
  const config = await getEmailTemplates()
  const allVariables = { ...config.settings, ...variables }
  
  return {
    subject: replaceTemplateVariables(template.subject, allVariables),
    html: replaceTemplateVariables(template.html, allVariables),
    text: replaceTemplateVariables(template.text, allVariables)
  }
} 