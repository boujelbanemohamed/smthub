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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const appId = parseInt(params.id)
    const appData = await request.json()
    const applications = await readApplications()

    const app = applications.find(app => app.id === appId)
    if (!app) {
      return NextResponse.json({ error: "Application non trouvée" }, { status: 404 })
    }

    const updatedApp = { ...app, ...appData, id: appId }
    const index = applications.findIndex(a => a.id === appId)
    applications[index] = updatedApp
    await writeApplications(applications)
    return NextResponse.json(applications[index])
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const appId = parseInt(params.id)
    const applications = await readApplications()
    const app = applications.find(app => app.id === appId)

    if (!app) {
      return NextResponse.json({ error: "Application non trouvée" }, { status: 404 })
    }

    const filtered = applications.filter(a => a.id !== appId)
    await writeApplications(filtered)
    return NextResponse.json({ message: "Application supprimée" })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
