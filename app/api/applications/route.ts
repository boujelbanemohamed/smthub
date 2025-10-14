import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { cache } from "@/lib/cache"

const DATA_FILE = path.join(process.cwd(), "data", "applications.json")

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
}

async function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

function readApplications(): Application[] {
  // Vérifier le cache d'abord
  const cached = cache.get('applications')
  if (cached) return cached

  try {
    // Pour l'instant, retourner les données par défaut
    // Le cache sera géré par les API routes
    const initialData: Application[] = [
      {
        id: 1,
        nom: "Gmail",
        image_url: "/placeholder.svg?height=64&width=64&text=Gmail",
        app_url: "https://gmail.com",
        ordre_affichage: 1,
      },
      {
        id: 2,
        nom: "Google Drive",
        image_url: "/placeholder.svg?height=64&width=64&text=Drive",
        app_url: "https://drive.google.com",
        ordre_affichage: 2,
      },
      {
        id: 3,
        nom: "Slack",
        image_url: "/placeholder.svg?height=64&width=64&text=Slack",
        app_url: "https://slack.com",
        ordre_affichage: 3,
      },
    ]

    // Mettre en cache les données initiales
    cache.set('applications', initialData, 5 * 60 * 1000)
    return initialData
  } catch {
    return []
  }
}

async function writeApplications(applications: Application[]) {
  try {
    await ensureDataDir()
    await fs.writeFile(DATA_FILE, JSON.stringify(applications, null, 2))
    
    // Invalider le cache après écriture
    cache.delete('applications')
  } catch (error) {
    console.error('Erreur lors de l\'écriture des applications:', error)
  }
}

export async function GET() {
  try {
    const applications = readApplications()
    const sortedApps = applications.sort((a, b) => a.ordre_affichage - b.ordre_affichage)
    return NextResponse.json(sortedApps)
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nom, image_url, app_url, ordre_affichage } = body

    if (!nom || !image_url || !app_url) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const applications = await readApplications()
    const newId = Math.max(0, ...applications.map((app) => app.id)) + 1

    const newApp: Application = {
      id: newId,
      nom,
      image_url,
      app_url,
      ordre_affichage: ordre_affichage || applications.length,
    }

    applications.push(newApp)
    await writeApplications(applications)

    return NextResponse.json(newApp, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
