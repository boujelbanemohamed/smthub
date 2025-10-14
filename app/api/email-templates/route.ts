import { type NextRequest, NextResponse } from "next/server"
import { getEmailTemplates, saveEmailTemplates, getTemplateById, updateTemplate, updateSettings } from "@/lib/email-templates"
import { requireAdmin } from "@/lib/auth"
import { logTemplateAction, logError } from "@/lib/logger"

export async function GET() {
  try {
    const config = await getEmailTemplates()
    return NextResponse.json(config)
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture des templates" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin() // Seuls les admins peuvent modifier les templates
    
    const body = await request.json()
    const { action, data } = body

    // Récupérer l'admin depuis la session
    const cookieStore = require("next/headers").cookies()
    const session = cookieStore.get("user-session")
    let adminName = "Administrateur"
    if (session?.value) {
      try {
        const userData = JSON.parse(session.value)
        adminName = userData.nom || "Administrateur"
      } catch {}
    }

    switch (action) {
      case "updateTemplate":
        const { id, updates } = data
        await updateTemplate(id, updates)
        
        // Logger l'action
        await logTemplateAction(
          "Modification template",
          id,
          0, // ID admin par défaut
          adminName,
          `Template modifié: ${id} - ${Object.keys(updates).join(", ")}`
        )
        
        return NextResponse.json({ success: true, message: "Template mis à jour" })

      case "updateSettings":
        await updateSettings(data)
        
        // Logger l'action
        await logTemplateAction(
          "Modification paramètres",
          "settings",
          0, // ID admin par défaut
          adminName,
          `Paramètres des templates modifiés: ${Object.keys(data).join(", ")}`
        )
        
        return NextResponse.json({ success: true, message: "Paramètres mis à jour" })

      case "resetTemplates":
        const config = await getEmailTemplates()
        // Réinitialiser les templates aux valeurs par défaut
        await saveEmailTemplates(config)
        
        // Logger l'action
        await logTemplateAction(
          "Réinitialisation templates",
          "all",
          0, // ID admin par défaut
          adminName,
          "Tous les templates ont été réinitialisés aux valeurs par défaut"
        )
        
        return NextResponse.json({ success: true, message: "Templates réinitialisés" })

      default:
        await logError(
          "Templates emails",
          `Action non reconnue: ${action}`,
          "Action non reconnue",
          0, // ID admin par défaut
          adminName
        )
        return NextResponse.json({ error: "Action non reconnue" }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    
    // Logger l'erreur
    const cookieStore = require("next/headers").cookies()
    const session = cookieStore.get("user-session")
    let adminName = "Administrateur"
    if (session?.value) {
      try {
        const userData = JSON.parse(session.value)
        adminName = userData.nom || "Administrateur"
      } catch {}
    }

    await logError(
      "Templates emails",
      "Erreur lors de la modification des templates",
      error instanceof Error ? error.message : "Erreur inconnue",
      0, // ID admin par défaut
      adminName
    )
    
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 })
  }
} 