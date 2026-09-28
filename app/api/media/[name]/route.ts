import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

// Sert les fichiers téléversés (logos, avatars) depuis public/uploads AU MOMENT
// de la requête. Nécessaire car `next start` fige la liste des fichiers de
// public/ au démarrage : un fichier uploadé pendant que le serveur tourne
// renverrait sinon un 404 (image cassée). Cette route lit le disque à chaque
// appel, donc les nouveaux uploads s'affichent immédiatement.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  // Anti-traversée de répertoire : on n'accepte qu'un nom de fichier simple.
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
    return NextResponse.json({ error: "Nom invalide" }, { status: 400 })
  }
  const ext = path.extname(name).toLowerCase()
  const type = CONTENT_TYPES[ext]
  if (!type) return NextResponse.json({ error: "Type non autorisé" }, { status: 400 })

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, name))
    const headers: Record<string, string> = {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      // Empêche le navigateur de « deviner » un autre type que celui déclaré.
      "X-Content-Type-Options": "nosniff",
    }
    // Durcissement anti-XSS pour les SVG : un SVG piégé ne doit jamais pouvoir
    // exécuter de script s'il est ouvert directement. On neutralise tout
    // contenu actif via une CSP « sandbox » et on force le téléchargement en
    // navigation directe (les balises <img> continuent de l'afficher).
    if (ext === ".svg") {
      headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      headers["Content-Disposition"] = `attachment; filename="${name}"`
    }
    return new NextResponse(data as any, { status: 200, headers })
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 })
  }
}
