import { type NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { getReportConfig, saveReportConfig } from "@/lib/report-config"
import { sendReports } from "@/lib/report-scheduler"
import { logAction } from "@/lib/logger"

// GET → configuration des rapports planifiés (super-admin)
export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await getReportConfig())
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT { enabled, frequency, hour } → met à jour la config.
// PUT { sendNow: true } → envoie immédiatement le rapport (test).
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    const body = await request.json().catch(() => ({}))
    const cfg = await getReportConfig()

    if (body.sendNow) {
      const n = await sendReports(body.frequency === "monthly" ? "monthly" : cfg.frequency)
      await logAction("Rapport envoyé", `Envoi manuel du rapport (${n} email(s))`, "INFO", admin.id, admin.nom)
      return NextResponse.json({ success: true, sent: n })
    }

    const next = {
      enabled: typeof body.enabled === "boolean" ? body.enabled : cfg.enabled,
      frequency: body.frequency === "monthly" ? "monthly" : body.frequency === "weekly" ? "weekly" : cfg.frequency,
      hour: Number.isFinite(body.hour) ? Math.max(0, Math.min(23, Math.floor(body.hour))) : cfg.hour,
      lastSent: cfg.lastSent ?? null,
    } as const
    await saveReportConfig(next)
    await logAction("Rapports planifiés", `Config: ${next.enabled ? "activé" : "désactivé"}, ${next.frequency}, ${next.hour}h`, "INFO", admin.id, admin.nom)
    return NextResponse.json(next)
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
