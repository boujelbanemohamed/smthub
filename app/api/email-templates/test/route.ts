import { type NextRequest, NextResponse } from "next/server"
import { generateEmailFromTemplate } from "@/lib/email-templates"
import { requireAdmin } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    await requireAdmin() // Seuls les admins peuvent tester les templates
    
    const { templateId, testEmail } = await request.json()

    if (!templateId) {
      return NextResponse.json({ error: "ID du template requis" }, { status: 400 })
    }

    // Données de test pour chaque type de template
    const testVariables: Record<string, Record<string, string>> = {
      welcome: {
        userName: "Jean Dupont",
        userEmail: testEmail || "test@example.com",
        companyName: "SMT HUB",
        supportEmail: "support@smt.com",
        websiteUrl: "http://localhost:4000",
        primaryColor: "#1e40af",
        secondaryColor: "#3b82f6"
      },
      "profile-update": {
        userName: "Jean Dupont",
        companyName: "SMT HUB",
        changesList: "<li>Nom mis à jour</li><li>Email modifié</li>",
        changesText: "- Nom mis à jour\n- Email modifié",
        supportEmail: "support@smt.com",
        modificationDate: new Date().toLocaleString('fr-FR')
      },
      "access-granted": {
        userName: "Jean Dupont",
        appName: "Gmail",
        accessLevel: "read",
        accessLevelDescription: "Lecture seule - Vous pouvez consulter mais pas modifier",
        adminName: "Admin User",
        accessDate: new Date().toLocaleString('fr-FR'),
        companyName: "SMT HUB",
        supportEmail: "support@smt.com"
      },
      "access-revoked": {
        userName: "Jean Dupont",
        appName: "Slack",
        adminName: "Admin User",
        accessDate: new Date().toLocaleString('fr-FR'),
        companyName: "SMT HUB",
        supportEmail: "support@smt.com"
      }
    }

    const variables = testVariables[templateId]
    if (!variables) {
      return NextResponse.json({ error: "Template non trouvé" }, { status: 404 })
    }

    const emailContent = await generateEmailFromTemplate(templateId, variables)
    
    if (!emailContent) {
      return NextResponse.json({ error: "Erreur lors de la génération du template" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      template: emailContent,
      variables: variables
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors du test du template" }, { status: 500 })
  }
} 