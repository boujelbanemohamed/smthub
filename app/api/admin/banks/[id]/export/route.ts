import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { getBank } from "@/lib/banks-store"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

// GET → exporte la configuration d'une banque en JSON : ses paramètres, les
// applications attribuées, ses utilisateurs (sans mot de passe) et leurs accès.
// Sert à dupliquer rapidement une banque (via l'import). Super-admin uniquement.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
    const id = parseInt((await params).id)
    if (Number.isNaN(id)) return NextResponse.json({ error: "Banque invalide" }, { status: 400 })
    const bank = await getBank(id)
    if (!bank) return NextResponse.json({ error: "Banque introuvable" }, { status: 404 })

    let users: any[] = []
    let access: any[] = []
    try { users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8")) } catch { users = [] }
    try { access = JSON.parse(await fs.readFile(ACCESS_FILE, "utf-8")) } catch { access = [] }

    const bankUsers = users.filter((u) => u.banque_id === id)
    const bankUserIds = new Set(bankUsers.map((u) => u.id))

    const payload = {
      _type: "smthub-bank-config",
      _version: 1,
      exported_at: new Date().toISOString(),
      bank: {
        nom: bank.nom,
        actif: bank.actif,
        app_ids: bank.app_ids,
        logo_url: bank.logo_url ?? null,
        theme_color: bank.theme_color ?? null,
      },
      users: bankUsers.map((u) => ({
        nom: u.nom,
        email: u.email,
        role: u.role,
        actif: u.actif !== false,
        // Accès individuels (ids d'applications) de cet utilisateur.
        app_ids: access.filter((a) => a.utilisateur_id === u.id && bankUserIds.has(a.utilisateur_id)).map((a) => a.application_id),
      })),
    }

    const filename = `banque-${bank.nom.replace(/[^a-zA-Z0-9_-]+/g, "_")}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
