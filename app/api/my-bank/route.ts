import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getBank } from "@/lib/banks-store"

// GET → banque de l'utilisateur courant (nom + logo), ou null s'il n'est
// rattaché à aucune banque. Accessible à tout utilisateur authentifié :
// ne renvoie que sa propre banque (pas de fuite entre banques).
export async function GET() {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    if (me.banque_id == null) return NextResponse.json(null)
    const bank = await getBank(me.banque_id)
    if (!bank) return NextResponse.json(null)
    return NextResponse.json({ id: bank.id, nom: bank.nom, logo_url: bank.logo_url ?? null })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
