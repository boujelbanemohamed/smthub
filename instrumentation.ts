// Hook d'instrumentation Next.js : exécuté une seule fois au démarrage du
// serveur. On y démarre le planificateur de sauvegarde automatique (uniquement
// côté Node, pas sur l'edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup-scheduler")
    startBackupScheduler()
  }
}
