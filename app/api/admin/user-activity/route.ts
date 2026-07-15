import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, requireSuperAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { deleteLogsByIds } from "@/lib/logger"
import { bankUserIds } from "@/lib/banks-store"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")

// Borne temporelle : un log est retenu si son horodatage est dans [start, end].
// start/end sont des dates "YYYY-MM-DD" (end inclus jusqu'à la fin de journée).
function inRange(ts: string, startDate?: string | null, endDate?: string | null): boolean {
  const t = new Date(ts).getTime()
  if (startDate) {
    const s = new Date(startDate + "T00:00:00").getTime()
    if (!Number.isNaN(s) && t < s) return false
  }
  if (endDate) {
    const e = new Date(endDate + "T23:59:59.999").getTime()
    if (!Number.isNaN(e) && t > e) return false
  }
  return true
}

// Actions considérées comme des « modifications » apportées par l'utilisateur
// sur son propre compte (changement mot de passe, avatar, email, nom…).
const MODIFICATION_ACTIONS = [
  "Mise à jour profil",
  "Réinitialisation mot de passe",
]

// GET ?userId=X → activité d'un utilisateur :
//   - usedApps : applications qu'il a ouvertes (avec nombre + dernière ouverture)
//   - modifications : changements de compte (mot de passe, avatar, etc.)
export async function GET(request: NextRequest) {
  try {
    const me = await requireAdmin()
    const params = new URL(request.url).searchParams
    // userId = "all" (ou vide) → tous les utilisateurs ; sinon un id numérique.
    const userIdParam = params.get("userId") || ""
    const allUsers = userIdParam === "" || userIdParam === "all"
    const userId = allUsers ? NaN : Number(userIdParam)
    if (!allUsers && Number.isNaN(userId)) {
      return NextResponse.json({ error: "userId invalide" }, { status: 400 })
    }

    // Cloisonnement : un admin de banque ne consulte que les utilisateurs de sa
    // banque. Cible précise hors banque → refus ; sinon on borne aux ids banque.
    const bankIds = isBankAdmin(me) ? await bankUserIds(me.banque_id!) : null
    if (bankIds && !allUsers && !bankIds.has(userId)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }
    // Fenêtre temporelle facultative : ?hours=48 → dernières 48 h (popup),
    // ou ?startDate / ?endDate (section admin, filtre par date).
    const hours = params.get("hours") ? parseInt(params.get("hours")!) : 0
    let sinceTs = hours > 0 ? Date.now() - hours * 3600 * 1000 : 0
    let startDate = params.get("startDate") || undefined
    let endDate = params.get("endDate") || undefined

    // Cloisonnement temporel : un admin de banque ne peut JAMAIS remonter au-delà
    // de 48 h, quels que soient les paramètres reçus. On force la fenêtre et on
    // ignore tout filtre de dates plus large.
    if (bankIds) {
      const min48 = Date.now() - 48 * 3600 * 1000
      sinceTs = sinceTs === 0 ? min48 : Math.max(sinceTs, min48)
      startDate = undefined
      endDate = undefined
    }
    // Pagination des modifications
    const limit = params.get("limit") ? Math.max(1, parseInt(params.get("limit")!)) : 10
    const offset = params.get("offset") ? Math.max(0, parseInt(params.get("offset")!)) : 0

    let logs: any[] = []
    try {
      logs = JSON.parse(await fs.readFile(LOGS_FILE, "utf-8"))
    } catch {
      logs = []
    }

    const mine = logs.filter(
      (l) =>
        (allUsers || l.userId === userId) &&
        (bankIds === null || (typeof l.userId === "number" && bankIds.has(l.userId))) &&
        (sinceTs === 0 || new Date(l.timestamp).getTime() >= sinceTs) &&
        inRange(l.timestamp, startDate, endDate)
    )

    // Applications utilisées (on garde aussi les ids des logs pour la suppression)
    const byApp = new Map<string, { appId: number; nom: string; count: number; last: string; ids: string[] }>()
    for (const l of mine) {
      if (l.action !== "Ouverture application") continue
      const appId = l.metadata?.appId ?? -1
      const nom = l.metadata?.appName ?? `Application ${appId}`
      const key = String(appId)
      const cur = byApp.get(key) || { appId, nom, count: 0, last: l.timestamp, ids: [] as string[] }
      cur.count++
      cur.nom = nom
      cur.ids.push(l.id)
      if (new Date(l.timestamp).getTime() > new Date(cur.last).getTime()) cur.last = l.timestamp
      byApp.set(key, cur)
    }
    const usedApps = Array.from(byApp.values()).sort((a, b) => b.count - a.count)

    // Modifications de compte (paginées)
    const allModifs = mine
      .filter((l) => MODIFICATION_ACTIONS.includes(l.action))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map((l) => ({ id: l.id, action: l.action, details: l.details, timestamp: l.timestamp, userId: l.userId, userName: l.userName }))
    const modificationsTotal = allModifs.length
    const modifications = allModifs.slice(offset, offset + limit)

    return NextResponse.json({ usedApps, modifications, modificationsTotal, limit, offset })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE → supprime des lignes d'activité d'un utilisateur.
// Corps JSON :
//   { ids: [...] }                         → supprime ces lignes précises
//   { userId, all: true, startDate?, endDate? } → supprime TOUTE l'activité de
//        l'utilisateur (dans la fenêtre de dates si fournie)
export async function DELETE(request: NextRequest) {
  try {
    // La suppression d'activité/logs est réservée au super-admin.
    await requireSuperAdmin()
    const body = await request.json().catch(() => ({}))

    // 1) Suppression de lignes précises par id
    if (Array.isArray(body?.ids) && body.ids.length > 0) {
      const deleted = await deleteLogsByIds(body.ids.map((x: any) => String(x)))
      return NextResponse.json({ success: true, deleted })
    }

    // 2) Suppression de toute l'activité (un utilisateur, ou tous) avec dates éventuelles
    if (!body?.all) {
      return NextResponse.json({ error: "Précisez all:true ou une liste d'ids" }, { status: 400 })
    }
    const allUsers = body?.userId === "all" || body?.userId === undefined || body?.userId === null
    const userId = allUsers ? NaN : Number(body?.userId)
    if (!allUsers && Number.isNaN(userId)) {
      return NextResponse.json({ error: "userId invalide" }, { status: 400 })
    }

    let logs: any[] = []
    try {
      logs = JSON.parse(await fs.readFile(LOGS_FILE, "utf-8"))
    } catch {
      logs = []
    }
    const ids = logs
      .filter((l) => (allUsers || l.userId === userId) && inRange(l.timestamp, body.startDate, body.endDate))
      .map((l) => l.id)
    const deleted = await deleteLogsByIds(ids)
    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
