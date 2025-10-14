import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { logSmtpAction, logError } from "@/lib/logger"
import { requireAdmin } from "@/lib/auth"
import { promises as fs } from "fs"
import path from "path"

const SMTP_CONFIG_FILE = path.join(process.cwd(), "data", "smtp-config.json")

const defaultSmtpConfig = {
  host: "smtp.gmail.com",
  port: "587",
  secure: false,
  user: "",
  password: "",
  from_name: "SMT HUB",
  from_email: ""
}

async function readSmtpConfig() {
  try {
    const data = await fs.readFile(SMTP_CONFIG_FILE, "utf-8")
    return { ...defaultSmtpConfig, ...JSON.parse(data) }
  } catch {
    return defaultSmtpConfig
  }
}

async function writeSmtpConfig(config: any) {
  const dir = path.dirname(SMTP_CONFIG_FILE)
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
  await fs.writeFile(SMTP_CONFIG_FILE, JSON.stringify(config, null, 2))
}

export async function GET() {
  try {
    await requireAdmin()
    const config = await readSmtpConfig()
    const { password, ...configWithoutPassword } = config
    return NextResponse.json(configWithoutPassword)
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const newConfig = await request.json()
    
    // Validation des données requises
    if (!newConfig.host || !newConfig.port || !newConfig.user || !newConfig.from_email) {
      await logError(
        "Configuration SMTP",
        `Tentative de sauvegarde avec données manquantes: ${JSON.stringify(newConfig)}`,
        "Données requises manquantes"
      )
      return NextResponse.json({ 
        error: "Serveur, port, utilisateur et email expéditeur sont requis" 
      }, { status: 400 })
    }

    const current = await readSmtpConfig()
    const smtpConfig = { ...current, ...newConfig }
    
    console.log("Configuration SMTP mise à jour:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      user: smtpConfig.user,
      from_name: smtpConfig.from_name,
      from_email: smtpConfig.from_email
    })

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

    await writeSmtpConfig(smtpConfig)

    await logSmtpAction(
      "Configuration SMTP",
      0, // ID admin par défaut
      adminName,
      `Configuration SMTP mise à jour: ${newConfig.host}:${newConfig.port} (${newConfig.user})`
    )

    return NextResponse.json({ message: "Configuration SMTP sauvegardée avec succès" })
  } catch (error) {
    console.error("Erreur lors de la sauvegarde SMTP:", error)
    await logError(
      "Configuration SMTP",
      "Erreur lors de la sauvegarde de la configuration SMTP",
      error instanceof Error ? error.message : "Erreur inconnue"
    )
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 })
  }
}

// Fonction pour obtenir la configuration SMTP (utilisée par d'autres APIs)
export function getSmtpConfig() {
  return smtpConfig
}
