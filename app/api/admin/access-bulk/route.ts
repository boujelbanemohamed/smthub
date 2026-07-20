import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { getBank, bankUserIds } from "@/lib/banks-store"
import { logAccessAction } from "@/lib/logger"
import { notify } from "@/lib/notifications-store"

const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

interface Access {
  utilisateur_id: number
  application_id: number
}

async function readAccess(): Promise<Access[]> {
  try {
    return JSON.parse(await fs.readFile(ACCESS_FILE, "utf-8"))
  } catch {
    return []
  }
}

async function writeAccess(items: Access[]) {
  await fs.mkdir(path.dirname(ACCESS_FILE), { recursive: true })
  await fs.writeFile(ACCESS_FILE, JSON.stringify(items, null, 2))
}

// POST { user_ids: number[], application_ids: number[], action: "grant" | "revoke" }
// Accorde (ou révoque) en lot un ensemble d'applications à un ensemble
// d'utilisateurs — « donner accès à un lot d'apps à un groupe d'utilisateurs ».
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { user_ids, application_ids, action } = await request.json()

    if (!Array.isArray(user_ids) || !Array.isArray(application_ids) || user_ids.length === 0 || application_ids.length === 0) {
      return NextResponse.json({ error: "Sélectionnez au moins un utilisateur et une application" }, { status: 400 })
    }
    const mode = action === "revoke" ? "revoke" : "grant"

    // Cloisonnement : un admin de banque ne peut agir que sur les utilisateurs de
    // sa banque et les applications qui lui sont attribuées.
    let allowUser: (id: number) => boolean = () => true
    let allowApp: (id: number) => boolean = () => true
    if (isBankAdmin(admin)) {
      const uids = await bankUserIds(admin.banque_id!)
      const bank = await getBank(admin.banque_id!)
      const apps = new Set(bank?.app_ids || [])
      allowUser = (id) => uids.has(id)
      allowApp = (id) => apps.has(id)
    }

    let access = await readAccess()
    const has = (u: number, a: number) => access.some((x) => x.utilisateur_id === u && x.application_id === a)

    let changed = 0
    const perUser = new Map<number, number>() // utilisateur → nb d'accès modifiés
    for (const u of user_ids) {
      for (const a of application_ids) {
        const uid = Number(u), aid = Number(a)
        if (Number.isNaN(uid) || Number.isNaN(aid)) continue
        if (!allowUser(uid) || !allowApp(aid)) continue
        if (mode === "grant") {
          if (!has(uid, aid)) {
            access.push({ utilisateur_id: uid, application_id: aid })
            changed++; perUser.set(uid, (perUser.get(uid) || 0) + 1)
          }
        } else {
          if (has(uid, aid)) {
            access = access.filter((x) => !(x.utilisateur_id === uid && x.application_id === aid))
            changed++; perUser.set(uid, (perUser.get(uid) || 0) + 1)
          }
        }
      }
    }

    await writeAccess(access)
    // Notifie chaque utilisateur concerné (résumé).
    for (const [uid, n] of perUser) {
      await notify(uid, {
        type: mode === "grant" ? "access_granted" : "access_revoked",
        message: mode === "grant"
          ? `${n} nouvel(le)(s) accès à des applications vous ${n > 1 ? "ont" : "a"} été accordé(s).`
          : `${n} accès à des applications vous ${n > 1 ? "ont" : "a"} été retiré(s).`,
      })
    }
    await logAccessAction(
      mode === "grant" ? "Accord d'accès groupé" : "Révocation d'accès groupée",
      0,
      "-",
      0,
      "-",
      `${changed} accès ${mode === "grant" ? "accordé(s)" : "révoqué(s)"} pour ${user_ids.length} utilisateur(s) × ${application_ids.length} application(s) | par: ${admin.nom}`
    )

    return NextResponse.json({ changed })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
