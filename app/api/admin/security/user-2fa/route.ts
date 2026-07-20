import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { listOverrides, setOverride, type TwoFactorOverride } from "@/lib/two-factor-store"
import { logUserAction } from "@/lib/logger"

const VALID: TwoFactorOverride[] = ["inherit", "totp", "email", "disabled"]

// GET → réglages 2FA par utilisateur (super-admin uniquement).
export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json({ overrides: await listOverrides() })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT { userId, override } → change le réglage 2FA d'un utilisateur.
export async function PUT(request: NextRequest) {
  try {
    const me = await requireSuperAdmin()
    const { userId, override } = await request.json().catch(() => ({}))
    if (typeof userId !== "number" || !VALID.includes(override)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 })
    }
    await setOverride(userId, override)
    await logUserAction("Sécurité", me.id, me.nom, `2FA utilisateur #${userId} → ${override}`)
    return NextResponse.json({ success: true })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
