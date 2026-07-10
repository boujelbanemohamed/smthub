import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { listDeposits, addDeposit } from "@/lib/app-code-store"
import { logApplicationAction, logError } from "@/lib/logger"

const MAX_TOTAL = 50 * 1024 * 1024 // 50 Mo par dépôt

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")
}

// GET → liste des dépôts de code de l'application (admin)
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin()
    const appId = parseInt(params.id)
    if (Number.isNaN(appId)) return NextResponse.json({ error: "Application invalide" }, { status: 400 })
    return NextResponse.json(await listDeposits(appId))
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST (multipart/form-data) → charge un dépôt de code (admin)
//   champs : note, kind ("folder" | "zip"), files[] , paths (JSON des chemins relatifs)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    const appId = parseInt(params.id)
    if (Number.isNaN(appId)) return NextResponse.json({ error: "Application invalide" }, { status: 400 })

    const form = await request.formData()
    const note = String(form.get("note") || "")
    const kind = form.get("kind") === "zip" ? "zip" : "folder"
    const files = form.getAll("files").filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }

    // Chemins relatifs (pour préserver l'arborescence d'un dossier). Alignés sur
    // l'ordre des fichiers ; à défaut on retombe sur le nom du fichier.
    let paths: string[] = []
    try {
      const raw = form.get("paths")
      if (typeof raw === "string") paths = JSON.parse(raw)
    } catch {
      paths = []
    }

    let total = 0
    const incoming: { path: string; data: Buffer }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const buf = Buffer.from(await file.arrayBuffer())
      total += buf.length
      if (total > MAX_TOTAL) {
        return NextResponse.json({ error: "Dépôt trop volumineux (max 50 Mo au total)." }, { status: 400 })
      }
      const rel = (paths[i] && String(paths[i])) || file.name
      incoming.push({ path: rel, data: buf })
    }

    const deposit = await addDeposit(appId, note, admin.nom, incoming, kind)
    await logApplicationAction(
      "Chargement code application",
      appId,
      "",
      admin.id,
      admin.nom,
      `Dépôt de code ajouté (${deposit.files.length} fichier(s), ${(deposit.total_size / 1024).toFixed(0)} Ko)`
    )
    return NextResponse.json(deposit, { status: 201 })
  } catch (error) {
    await logError("Chargement code application", "Erreur lors du chargement d'un dépôt de code", error instanceof Error ? error.message : "Erreur inconnue")
    if (unauthorized(error)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 })
  }
}
