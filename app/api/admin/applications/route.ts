import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { promises as fs } from "fs"
import path from "path"

const DATA_FILE = path.join(process.cwd(), "data", "applications.json")

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
}

async function readApplications(): Promise<Application[]> {
  try {
    const data = await fs.readFile(DATA_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeApplications(applications: Application[]) {
  const dataDir = path.dirname(DATA_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(applications, null, 2))
}

export async function GET() {
  try {
    await requireAdmin()
    const applications = await readApplications()
    return NextResponse.json(applications.sort((a, b) => a.ordre_affichage - b.ordre_affichage))
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const appData = await request.json()
    const applications = await readApplications()

    const newApp = {
      id: Math.max(0, ...applications.map(app => app.id)) + 1,
      nom: appData.nom,
      image_url: appData.image_url || "",
      app_url: appData.app_url,
      ordre_affichage: appData.ordre_affichage || applications.length + 1
    }

    applications.push(newApp)
    await writeApplications(applications)

    return NextResponse.json(newApp, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
