import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { getBank } from "@/lib/banks-store"

const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")

// GET → liste des applications visibles par l'admin courant :
//   - super-admin     → toutes les applications
//   - admin de banque → uniquement celles attribuées à sa banque (lecture seule)
// Sert de source à l'écran « Gestion des accès » (et à l'affichage) sans exposer
// la gestion des applications, réservée au super-admin.
export async function GET() {
  try {
    const me = await requireAdmin()
    let apps: any[] = []
    try {
      apps = JSON.parse(await fs.readFile(APPLICATIONS_FILE, "utf-8"))
    } catch {
      apps = []
    }
    if (isBankAdmin(me)) {
      const bank = await getBank(me.banque_id!)
      const allowed = new Set(bank?.app_ids || [])
      apps = apps.filter((a: any) => allowed.has(a.id))
    }
    apps.sort((a: any, b: any) => (a.ordre_affichage || 0) - (b.ordre_affichage || 0))
    return NextResponse.json(apps)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
