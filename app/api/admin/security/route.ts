import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { getSecurityConfig, setSecurityConfig } from "@/lib/security-config"
import { logUserAction } from "@/lib/logger"

// GET → configuration de sécurité courante (super-admin uniquement).
export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json({ config: await getSecurityConfig() })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT → met à jour la configuration de sécurité (super-admin uniquement).
export async function PUT(request: NextRequest) {
  try {
    const me = await requireSuperAdmin()
    const body = await request.json().catch(() => ({}))
    const config = await setSecurityConfig(body || {})
    await logUserAction("Sécurité", me.id, me.nom, "Mise à jour de la configuration de sécurité")
    return NextResponse.json({ success: true, config })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
