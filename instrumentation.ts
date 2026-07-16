// Hook d'instrumentation Next.js : exécuté une seule fois au démarrage du
// serveur. On y démarre le planificateur de sauvegarde automatique (uniquement
// côté Node, pas sur l'edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup-scheduler")
    startBackupScheduler()
    // Planificateur des rapports de statistiques envoyés par email.
    try {
      const { startReportScheduler } = await import("@/lib/report-scheduler")
      startReportScheduler()
    } catch (e) {
      console.error("[report-scheduler] Démarrage impossible:", e)
    }
    // Migration idempotente : accorde aux admins de banque existants l'accès à
    // toutes les applis de leur banque (une seule fois), pour que la « Gestion
    // des accès » reflète bien leur tableau de bord.
    try {
      const { ensureBankAdminsSeeded } = await import("@/lib/access-seed")
      await ensureBankAdminsSeeded()
    } catch (e) {
      console.error("[access-seed] Échec de l'initialisation des accès admins de banque:", e)
    }
  }
}
