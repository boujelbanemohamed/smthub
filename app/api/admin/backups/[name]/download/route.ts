import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { requireAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { resolveBackup } from "@/lib/backup-store"
import { logAction } from "@/lib/logger"

// POST { password } → télécharge une archive de sauvegarde (admin).
// Mot de passe requis : l'archive contient des données sensibles et les secrets.
export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const admin = await requireAdmin()
    const body = await request.json().catch(() => ({}))
    if (!(await verifyCurrentUserPassword(body?.password))) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
    }
    const name = decodeURIComponent((await params).name)
    const abs = await resolveBackup(name)
    if (!abs) return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 })

    const data = await fs.readFile(abs)
    const isTar = name.endsWith(".tar.gz")
    await logAction("Téléchargement sauvegarde", `Sauvegarde téléchargée: ${name}`, "INFO", admin.id, admin.nom)

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": isTar ? "application/gzip" : "application/zip",
        "Content-Disposition": `attachment; filename="${name.replace(/["\r\n]/g, "")}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
