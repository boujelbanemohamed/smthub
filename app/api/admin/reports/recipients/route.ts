import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { listBanks } from "@/lib/banks-store"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

// GET → liste des destinataires éligibles au rapport (super-admins + admins de
// chaque banque), pour permettre au super-admin d'activer/désactiver chacun.
export async function GET() {
  try {
    await requireSuperAdmin()
    let users: any[] = []
    try { users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8")) } catch { users = [] }
    const banks = await listBanks()
    const bankName = new Map<number, string>()
    for (const b of banks) bankName.set(b.id, b.nom)

    const recipients = users
      .filter((u) => u.role === "admin" && u.actif !== false && u.email)
      .map((u) => ({
        email: u.email,
        nom: u.nom,
        scope: u.banque_id == null ? "Super-admin (rapport global)" : (bankName.get(u.banque_id) || `Banque ${u.banque_id}`),
      }))
      // Super-admins d'abord, puis par banque
      .sort((a, b) => a.scope.localeCompare(b.scope))

    return NextResponse.json({ recipients })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
