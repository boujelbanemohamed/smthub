import { type NextRequest, NextResponse } from "next/server"
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const body = await request.json()
    const { nom, image_url, app_url, ordre_affichage } = body

    if (!nom || !image_url || !app_url) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const applications = await readApplications()
    const appIndex = applications.findIndex((app) => app.id === id)

    if (appIndex === -1) {
      return NextResponse.json({ error: "Application non trouvée" }, { status: 404 })
    }

    applications[appIndex] = {
      id,
      nom,
      image_url,
      app_url,
      ordre_affichage: ordre_affichage || 0,
    }

    await writeApplications(applications)
    return NextResponse.json(applications[appIndex])
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const applications = await readApplications()
    const filteredApps = applications.filter((app) => app.id !== id)

    if (filteredApps.length === applications.length) {
      return NextResponse.json({ error: "Application non trouvée" }, { status: 404 })
    }

    await writeApplications(filteredApps)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
