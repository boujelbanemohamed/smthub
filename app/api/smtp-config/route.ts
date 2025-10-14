import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin } from "@/lib/auth"

const SMTP_CONFIG_FILE = path.join(process.cwd(), "data", "smtp-config.json")

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

const defaultConfig: SmtpConfig = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  password: "",
  from_name: "SMT HUB",
  from_email: "",
  enabled: false,
}

async function readSmtpConfig(): Promise<SmtpConfig> {
  try {
    const data = await fs.readFile(SMTP_CONFIG_FILE, "utf-8")
    return { ...defaultConfig, ...JSON.parse(data) }
  } catch {
    return defaultConfig
  }
}

async function writeSmtpConfig(config: SmtpConfig) {
  const dataDir = path.dirname(SMTP_CONFIG_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(SMTP_CONFIG_FILE, JSON.stringify(config, null, 2))
}

export async function GET() {
  try {
    await requireAdmin()
    const config = await readSmtpConfig()
    
    // Don't send the password in the response for security
    const safeConfig = { ...config, password: config.password ? "••••••••" : "" }
    return NextResponse.json(safeConfig)
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { host, port, secure, user, password, from_name, from_email, enabled } = body

    // Validation
    if (!host || !user || !from_name || !from_email) {
      return NextResponse.json({ 
        error: "Les champs serveur, utilisateur, nom et email de l'expéditeur sont requis" 
      }, { status: 400 })
    }

    if (port < 1 || port > 65535) {
      return NextResponse.json({ error: "Le port doit être entre 1 et 65535" }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(from_email)) {
      return NextResponse.json({ error: "Format d'email invalide" }, { status: 400 })
    }

    // Get current config to preserve password if not provided
    const currentConfig = await readSmtpConfig()
    
    const newConfig: SmtpConfig = {
      host: host.trim(),
      port: parseInt(port) || 587,
      secure: Boolean(secure),
      user: user.trim(),
      password: password && password !== "••••••••" ? password : currentConfig.password,
      from_name: from_name.trim(),
      from_email: from_email.trim(),
      enabled: Boolean(enabled),
    }

    await writeSmtpConfig(newConfig)

    return NextResponse.json({ 
      success: true, 
      message: "Configuration SMTP sauvegardée avec succès" 
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    console.error("Erreur lors de la sauvegarde de la configuration SMTP:", error)
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 })
  }
}
