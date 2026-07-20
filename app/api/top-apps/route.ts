import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getCurrentUser, isBankAdmin } from "@/lib/auth"
import { bankUserIds } from "@/lib/banks-store"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")

// Construit le top 5 des applications ouvertes à partir d'une liste de logs.
function buildTop(logs: any[]) {
  const opens = logs.filter((l) => l.action === "Ouverture application")
  const byApp = new Map<string, { appId: number; nom: string; count: number }>()
  for (const l of opens) {
    const appId = l.metadata?.appId ?? -1
    const nom = l.metadata?.appName ?? `Application ${appId}`
    const key = String(appId)
    const cur = byApp.get(key) || { appId, nom, count: 0 }
    cur.count++
    cur.nom = nom
    byApp.set(key, cur)
  }
  return Array.from(byApp.values()).sort((a, b) => b.count - a.count).slice(0, 5)
}

// GET → 5 applications les plus utilisées.
//   - rôle "admin"       → global (toutes banques) + son propre top personnel
//   - admin de banque    → périmètre de sa banque + son propre top personnel
//   - rôle "utilisateur" → uniquement ses propres ouvertures
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    let logs: any[] = []
    try {
      logs = JSON.parse(await fs.readFile(LOGS_FILE, "utf-8"))
    } catch {
      logs = []
    }

    // Périmètre principal :
    //  - super-admin       → global (toutes banques)
    //  - admin de banque   → uniquement les utilisateurs de sa banque
    //  - utilisateur       → uniquement ses propres ouvertures
    let scopeLogs = logs
    let scope: "global" | "bank" | "personal" = "personal"
    if (user.role === "admin") {
      scope = "global"
    } else if (isBankAdmin(user)) {
      const ids = await bankUserIds(user.banque_id!)
      scopeLogs = logs.filter((l) => typeof l.userId === "number" && ids.has(l.userId))
      scope = "bank"
    } else {
      scopeLogs = logs.filter((l) => l.userId === user.id)
      scope = "personal"
    }

    const top = buildTop(scopeLogs)
    // Top personnel de l'utilisateur connecté : renvoyé uniquement pour les
    // admins (super-admin / admin de banque) puisqu'il diffère du périmètre
    // principal. Pour un utilisateur simple, il est déjà égal à `top`.
    const personal = scope === "personal" ? [] : buildTop(logs.filter((l) => l.userId === user.id))

    return NextResponse.json({ scope, top, personal })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
