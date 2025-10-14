import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    if (!session?.value) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("image") as File

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }

    // Vérifier le type de fichier
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 })
    }

    // Vérifier la taille (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 2MB)" }, { status: 400 })
    }

    await ensureUploadDir()

    // Générer un nom de fichier unique
    const timestamp = Date.now()
    const extension = path.extname(file.name)
    const filename = `${timestamp}${extension}`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Sauvegarder le fichier
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fs.writeFile(filepath, buffer)

    const url = `/uploads/${filename}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error("Erreur upload:", error)
    return NextResponse.json({ error: "Erreur lors du téléversement" }, { status: 500 })
  }
}
