import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { listBanks, addBank } from "@/lib/banks-store"
import { logAction } from "@/lib/logger"

// GET → liste des banques (super-admin)
export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listBanks())
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { nom, app_ids? } → crée une banque (super-admin)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    const { nom, app_ids } = await request.json()
    const result = await addBank(nom, Array.isArray(app_ids) ? app_ids : [])
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    await logAction("Création banque", `Banque créée: ${result.nom}`, "INFO", admin.id, admin.nom)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
