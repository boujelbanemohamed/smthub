import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getCurrentUser, isBankAdmin } from "@/lib/auth"
import { bankUserIds } from "@/lib/banks-store"

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")

// GET → 5 applications les plus utilisées.
//   - rôle "admin"       → toutes activités confondues (global)
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

    // Périmètre :
    //  - super-admin       → global (toutes banques)
    //  - admin de banque   → uniquement les utilisateurs de sa banque
    //  - utilisateur       → uniquement ses propres ouvertures
    let scope = logs
    if (isBankAdmin(user)) {
      const ids = await bankUserIds(user.banque_id!)
      scope = logs.filter((l) => typeof l.userId === "number" && ids.has(l.userId))
    } else if (user.role !== "admin") {
      scope = logs.filter((l) => l.userId === user.id)
    }
    const opens = scope.filter((l) => l.action === "Ouverture application")

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
    const top = Array.from(byApp.values()).sort((a, b) => b.count - a.count).slice(0, 5)

    return NextResponse.json({ scope: user.role === "admin" ? "global" : "personal", top })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
