import { type NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { getCurrentUser } from "@/lib/auth"
import { verifyPending } from "@/lib/twofa-token"
import { setPendingSecret } from "@/lib/two-factor-store"
import { generateSecret, otpauthUrl } from "@/lib/totp"
import { getSecurityConfig } from "@/lib/security-config"

// POST → démarre l'enrôlement TOTP : génère un secret, le mémorise (non
// confirmé) et renvoie le QR code + la clé manuelle. Accessible soit via un
// jeton 2FA en attente (enrôlement forcé à la connexion), soit via la session
// (configuration volontaire depuis le profil).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let userId: number | null = null
    let account = ""

    if (body?.pendingToken) {
      const p = await verifyPending(body.pendingToken)
      if (!p) return NextResponse.json({ error: "Session expirée, reconnectez-vous." }, { status: 401 })
      userId = p.uid
    } else {
      const me = await getCurrentUser()
      if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
      userId = me.id
      account = me.email
    }

    const secret = generateSecret()
    await setPendingSecret(userId!, secret)

    const cfg = await getSecurityConfig()
    const issuer = "SMT HUB"
    // Le libellé du compte : email si disponible, sinon identifiant.
    const url = otpauthUrl(secret, account || `utilisateur-${userId}`, issuer)
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 })

    return NextResponse.json({ secret, otpauthUrl: url, qr })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
