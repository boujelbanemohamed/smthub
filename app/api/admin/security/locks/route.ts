import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, isBankAdmin, authErrorResponse } from "@/lib/auth"
import { listLocked, unlockAccount } from "@/lib/login-attempts"
import { logUserAction } from "@/lib/logger"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

async function readUsers(): Promise<any[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
  } catch {
    return []
  }
}

// Restreint une liste d'emails au périmètre de l'admin : super-admin voit tout,
// l'admin de banque uniquement les comptes de sa banque.
async function scopeEmails(me: any, emails: string[]): Promise<Set<string>> {
  if (!isBankAdmin(me)) return new Set(emails.map((e) => e.toLowerCase()))
  const users = await readUsers()
  const mine = new Set(
    users
      .filter((u) => u.banque_id === me.banque_id)
      .map((u) => String(u.email).toLowerCase())
  )
  return mine
}

// GET → comptes verrouillés visibles par l'admin courant.
export async function GET() {
  try {
    const me = await requireAdmin()
    const locked = await listLocked()
    const allowed = await scopeEmails(me, locked.map((l) => l.email))
    const visible = locked.filter((l) => allowed.has(l.email.toLowerCase()))
    return NextResponse.json({ locked: visible })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST { email } → déverrouille un compte (dans le périmètre de l'admin).
export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin()
    const { email } = await request.json().catch(() => ({}))
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })
    // Vérifie le périmètre pour l'admin de banque.
    if (isBankAdmin(me)) {
      const allowed = await scopeEmails(me, [email])
      if (!allowed.has(String(email).toLowerCase())) {
        return NextResponse.json({ error: "Accès refusé à ce compte" }, { status: 403 })
      }
    }
    await unlockAccount(email)
    await logUserAction("Sécurité", me.id, me.nom, `Déverrouillage du compte ${email}`)
    return NextResponse.json({ success: true })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
