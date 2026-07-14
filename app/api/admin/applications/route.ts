import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { promises as fs } from "fs"
import path from "path"
import { logApplicationAction, logError } from "@/lib/logger"

const DATA_FILE = path.join(process.cwd(), "data", "applications.json")

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
  avatar_color?: string
  category?: string
  open_mode?: "newtab" | "embed" | "embed_newtab"
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
    await logError("Liste applications", "Erreur lors de la lecture des applications", error instanceof Error ? error.message : "Erreur inconnue")
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PATCH : réordonnancement en lot. Écrit toutes les positions en UNE seule
// opération pour éviter les races de lecture/écriture concurrentes sur le fichier.
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const { order } = await request.json()
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Paramètre 'order' invalide" }, { status: 400 })
    }
    const orderMap = new Map<number, number>()
    for (const item of order) {
      const id = Number(item?.id)
      const pos = Number(item?.ordre_affichage)
      if (!Number.isNaN(id) && !Number.isNaN(pos)) orderMap.set(id, pos)
    }

    const applications = await readApplications()
    for (const app of applications) {
      if (orderMap.has(app.id)) app.ordre_affichage = orderMap.get(app.id)!
    }
    await writeApplications(applications)

    return NextResponse.json(applications.sort((a, b) => a.ordre_affichage - b.ordre_affichage))
  } catch (error) {
    await logError("Réordonnancement applications", "Erreur lors du réordonnancement", error instanceof Error ? error.message : "Erreur inconnue")
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors du réordonnancement" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const appData = await request.json()

    // Le logo peut être un data URI base64 : borne la taille (~350 Ko de texte).
    if (typeof appData.image_url === "string" && appData.image_url.length > 350_000) {
      return NextResponse.json({ error: "Logo trop volumineux (max ~200 Ko)." }, { status: 400 })
    }

    const applications = await readApplications()

    const newApp = {
      id: Math.max(0, ...applications.map(app => app.id)) + 1,
      nom: appData.nom,
      image_url: appData.image_url || "",
      app_url: appData.app_url,
      ordre_affichage: appData.ordre_affichage || applications.length + 1,
      avatar_color: appData.avatar_color || "",
      category: (appData.category || "").trim(),
      open_mode: (["embed", "embed_newtab"].includes(appData.open_mode) ? appData.open_mode : "newtab") as "newtab" | "embed" | "embed_newtab"
    }

    applications.push(newApp)
    await writeApplications(applications)

    await logApplicationAction(
      "Création application",
      newApp.id,
      newApp.nom,
      admin.id,
      admin.nom,
      `Application créée: ${newApp.nom} (${newApp.app_url})`
    )

    return NextResponse.json(newApp, { status: 201 })
  } catch (error) {
    await logError("Création application", "Erreur lors de la création d'une application", error instanceof Error ? error.message : "Erreur inconnue")
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 })
  }
}
