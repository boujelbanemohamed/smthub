import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, authErrorResponse } from "@/lib/auth"
import { parseCsv } from "@/lib/csv"
import { logApplicationAction } from "@/lib/logger"

const DATA_FILE = path.join(process.cwd(), "data", "applications.json")

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
  avatar_color?: string
  category?: string
}

// POST { csv } → importe des applications. Colonnes : nom,app_url[,image_url,ordre_affichage]
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { csv } = await request.json()
    if (typeof csv !== "string" || !csv.trim()) {
      return NextResponse.json({ error: "Fichier CSV vide" }, { status: 400 })
    }

    const parsed = parseCsv(csv)
    if (parsed.length === 0) {
      return NextResponse.json({ error: "Aucune ligne exploitable" }, { status: 400 })
    }

    let apps: Application[] = []
    try {
      apps = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"))
    } catch {
      apps = []
    }

    let created = 0
    const errors: string[] = []
    let nextOrder = apps.reduce((m, a) => Math.max(m, a.ordre_affichage), 0)

    for (let i = 0; i < parsed.length; i++) {
      const line = i + 2
      const nom = (parsed[i].nom || "").trim()
      const app_url = (parsed[i].app_url || "").trim()
      const image_url = (parsed[i].image_url || "").trim()
      const category = (parsed[i].category || "").trim()
      const ordreRaw = (parsed[i].ordre_affichage || "").trim()

      if (!nom || !app_url) {
        errors.push(`Ligne ${line} : nom et app_url requis`)
        continue
      }

      const newId = apps.reduce((m, a) => Math.max(m, a.id), 0) + 1
      const ordre = ordreRaw && !Number.isNaN(parseInt(ordreRaw)) ? parseInt(ordreRaw) : ++nextOrder
      apps.push({ id: newId, nom, app_url, image_url, ordre_affichage: ordre, avatar_color: "", category })
      created++
    }

    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify(apps, null, 2))

    await logApplicationAction("Import applications", 0, "-", admin.id, admin.nom, `${created} application(s) importée(s), ${errors.length} erreur(s)`)

    return NextResponse.json({ created, errors })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur lors de l'import" }, { status: 500 })
  }
}
