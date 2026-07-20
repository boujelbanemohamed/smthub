import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { getLogs, verifyLogChain } from "@/lib/logger"
import { auditCategory, isAuditable, AUDIT_CATEGORIES } from "@/lib/audit"

// GET → journal d'audit filtré (super-admin uniquement).
// Query : q (texte), category, userId, from (ISO date), to (ISO date), limit.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const sp = request.nextUrl.searchParams
    const q = (sp.get("q") || "").trim().toLowerCase()
    const category = sp.get("category") || ""
    const userId = sp.get("userId") ? Number(sp.get("userId")) : null
    const from = sp.get("from") ? new Date(sp.get("from") + "T00:00:00").getTime() : null
    const to = sp.get("to") ? new Date(sp.get("to") + "T23:59:59").getTime() : null
    const limit = Math.min(Number(sp.get("limit") || 500), 2000)

    const all = await getLogs({ limit: 100000 })
    // Vérification d'intégrité de la chaîne AVANT filtrage (sur tout le journal).
    const integrity = await verifyLogChain()

    const events = all
      .filter((l: any) => isAuditable(l.action))
      .filter((l: any) => (category ? auditCategory(l.action) === category : true))
      .filter((l: any) => (userId != null ? l.userId === userId : true))
      .filter((l: any) => {
        const t = new Date(l.timestamp).getTime()
        if (from != null && t < from) return false
        if (to != null && t > to) return false
        return true
      })
      .filter((l: any) => {
        if (!q) return true
        return (
          (l.action || "").toLowerCase().includes(q) ||
          (l.details || "").toLowerCase().includes(q) ||
          (l.userName || "").toLowerCase().includes(q)
        )
      })
      .slice(0, limit)
      .map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        category: auditCategory(l.action),
        action: l.action,
        status: l.status,
        userId: l.userId ?? null,
        userName: l.userName ?? null,
        details: l.details,
        hash: l.hash ? String(l.hash).slice(0, 12) : null,
      }))

    return NextResponse.json({ events, integrity, categories: AUDIT_CATEGORIES })
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
