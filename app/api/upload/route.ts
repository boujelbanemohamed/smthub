import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAuth } from "@/lib/auth"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

// Signatures binaires (magic bytes) des formats autorisés - évite de faire confiance
// au Content-Type fourni par le client, qui peut être falsifié.
const MAGIC_BYTES: { mime: string; extension: string; check: (buf: Buffer) => boolean }[] = [
  {
    mime: "image/jpeg",
    extension: ".jpg",
    check: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mime: "image/png",
    extension: ".png",
    check: (buf) =>
      buf.length > 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    mime: "image/webp",
    extension: ".webp",
    check: (buf) =>
      buf.length > 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP",
  },
  {
    mime: "image/svg+xml",
    extension: ".svg",
    // SVG est du texte ; on vérifie juste la présence d'une balise <svg, sans tag <script>.
    check: (buf) => {
      const head = buf.subarray(0, Math.min(buf.length, 1024)).toString("utf-8").toLowerCase()
      return head.includes("<svg")
    },
  },
]

function detectFileType(buffer: Buffer): { mime: string; extension: string } | null {
  const match = MAGIC_BYTES.find((entry) => entry.check(buffer))
  return match ? { mime: match.mime, extension: match.extension } : null
}

function containsScript(buffer: Buffer): boolean {
  const text = buffer.toString("utf-8").toLowerCase()
  return text.includes("<script") || text.includes("onload=") || text.includes("javascript:")
}

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const formData = await request.formData()
    const file = formData.get("image") as File

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }

    // Vérifier la taille (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 2MB)" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Valider le contenu réel du fichier (magic bytes), pas le Content-Type déclaré par le client
    const detected = detectFileType(buffer)
    if (!detected) {
      return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 })
    }

    // Pour les SVG, refuser tout contenu actif (XSS stocké)
    if (detected.mime === "image/svg+xml" && containsScript(buffer)) {
      return NextResponse.json({ error: "Fichier SVG non autorisé (contenu actif détecté)" }, { status: 400 })
    }

    await ensureUploadDir()

    // Générer un nom de fichier unique avec l'extension déduite du contenu réel
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    const filename = `${timestamp}-${random}${detected.extension}`
    const filepath = path.join(UPLOAD_DIR, filename)

    await fs.writeFile(filepath, buffer)

    const url = `/uploads/${filename}`
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    console.error("Erreur upload:", error)
    return NextResponse.json({ error: "Erreur lors du téléversement" }, { status: 500 })
  }
}
