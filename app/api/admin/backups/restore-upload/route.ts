import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { requireAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { restoreFromArchive } from "@/lib/backup-store"
import { logAction, logError } from "@/lib/logger"

const MAX_UPLOAD = 200 * 1024 * 1024 // 200 Mo

// POST (multipart/form-data : password, file) → restaure à partir d'une archive
// fournie par l'admin (ex. une sauvegarde téléchargée précédemment). Mot de
// passe requis. ⚠️ Remplace les données actuelles, après copie de sécurité.
export async function POST(request: NextRequest) {
  let temp: string | null = null
  try {
    const admin = await requireAdmin()
    const form = await request.formData()
    const password = String(form.get("password") || "")
    if (!(await verifyCurrentUserPassword(password))) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
    }

    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }
    const isTar = /\.tar\.gz$/i.test(file.name)
    const isZip = /\.zip$/i.test(file.name)
    if (!isTar && !isZip) {
      return NextResponse.json({ error: "Format non supporté (.zip ou .tar.gz attendu)." }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD) {
      return NextResponse.json({ error: "Archive trop volumineuse (max 200 Mo)." }, { status: 400 })
    }

    // Écrit l'archive reçue dans un fichier temporaire avant extraction.
    const buf = Buffer.from(await file.arrayBuffer())
    temp = path.join(os.tmpdir(), `smthub-restore-${Date.now()}${isTar ? ".tar.gz" : ".zip"}`)
    await fs.writeFile(temp, buf)

    const { safety } = await restoreFromArchive(temp, isTar)
    await logAction("Restauration sauvegarde", `Restauration depuis un fichier importé: ${file.name}`, "WARNING", admin.id, admin.nom)
    return NextResponse.json({ success: true, message: "Restauration effectuée.", safety })
  } catch (error) {
    await logError("Restauration sauvegarde", "Erreur lors de la restauration importée", error instanceof Error ? error.message : "Erreur inconnue")
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la restauration" }, { status: 500 })
  } finally {
    if (temp) { try { await fs.rm(temp, { force: true }) } catch { /* ignore */ } }
  }
}
