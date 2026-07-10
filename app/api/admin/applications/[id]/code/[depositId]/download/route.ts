import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getDeposit, readDepositFiles } from "@/lib/app-code-store"
import { createZip } from "@/lib/zip-writer"
import { logApplicationAction } from "@/lib/logger"

// GET → télécharge le dépôt sous forme d'archive .zip (admin).
// Si le dépôt est déjà une unique archive .zip, elle est renvoyée telle quelle.
export async function GET(_request: NextRequest, { params }: { params: { id: string; depositId: string } }) {
  try {
    const admin = await requireAdmin()
    const appId = parseInt(params.id)
    if (Number.isNaN(appId)) return NextResponse.json({ error: "Application invalide" }, { status: 400 })

    const deposit = await getDeposit(appId, params.depositId)
    if (!deposit) return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 })

    const files = await readDepositFiles(deposit)
    if (files.length === 0) return NextResponse.json({ error: "Fichiers introuvables" }, { status: 404 })

    let body: Buffer
    let filename: string
    // Cas d'une seule archive .zip déjà fournie → on la renvoie directement.
    if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
      body = files[0].data
      filename = files[0].name
    } else {
      body = createZip(files)
      filename = `code-app${appId}-${deposit.id}.zip`
    }

    await logApplicationAction("Téléchargement code application", appId, "", admin.id, admin.nom, `Dépôt téléchargé (${deposit.id})`)

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename.replace(/["\r\n]/g, "")}"`,
        "Content-Length": String(body.length),
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
