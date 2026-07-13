import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import { requireAdmin, verifyCurrentUserPassword } from "@/lib/auth"
import { resolveBackup } from "@/lib/backup-store"
import { logAction, logError } from "@/lib/logger"

const run = promisify(execFile)

// POST { password } → restaure une sauvegarde (admin, mot de passe requis).
// ⚠️ Opération sensible : remplace les données actuelles. Par sécurité, le
// dossier data/ existant est d'abord DÉPLACÉ (jamais supprimé) vers
// data.avant-restauration-<horodatage>, récupérable en cas de problème.
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

    const cwd = process.cwd()
    const dataDir = path.join(cwd, "data")

    // 1) Copie de sécurité des données actuelles (déplacement, pas suppression).
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    let safety: string | null = null
    try {
      await fs.access(dataDir)
      safety = path.join(cwd, `data.avant-restauration-${ts}`)
      await fs.rename(dataDir, safety)
    } catch {
      // pas de dossier data/ à préserver
    }

    // 2) Extraction de l'archive à la racine du projet (elle contient data/…
    //    et éventuellement .env.production).
    try {
      if (name.endsWith(".tar.gz")) {
        await run("tar", ["-xzf", abs, "-C", cwd])
      } else {
        await run("unzip", ["-o", abs, "-d", cwd])
      }
    } catch (extractErr) {
      // Échec d'extraction : on tente de remettre les données d'origine.
      if (safety) {
        try {
          await fs.rm(dataDir, { recursive: true, force: true })
          await fs.rename(safety, dataDir)
        } catch { /* la copie de sécurité reste disponible sur le disque */ }
      }
      throw extractErr
    }

    await logAction("Restauration sauvegarde", `Sauvegarde restaurée: ${name}`, "WARNING", admin.id, admin.nom)
    return NextResponse.json({
      success: true,
      message: "Restauration effectuée.",
      safety: safety ? path.basename(safety) : null,
    })
  } catch (error) {
    await logError("Restauration sauvegarde", "Erreur lors de la restauration", error instanceof Error ? error.message : "Erreur inconnue")
    if (error instanceof Error && (error.message === "Admin access required" || error.message === "Authentication required")) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    return NextResponse.json({ error: "Erreur lors de la restauration" }, { status: 500 })
  }
}
