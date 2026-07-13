import { getBackupConfig, saveBackupConfig, isBackupDue } from "@/lib/backup-config"
import { createBackup, pruneOldBackups } from "@/lib/backup-store"

// Planificateur de sauvegarde intégré à l'application. Il tourne dans le
// processus Node (une seule instance en production, cf. ecosystem.config.js) et
// déclenche une sauvegarde quand la configuration l'exige — sans dépendre du
// cron système. Démarré une fois au boot via instrumentation.ts.

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // vérifie toutes les 5 minutes

// Empêche le double démarrage (Next peut ré-importer le module).
declare global {
  // eslint-disable-next-line no-var
  var __smthubBackupSchedulerStarted: boolean | undefined
}

async function tick(): Promise<void> {
  try {
    const cfg = await getBackupConfig()
    if (!isBackupDue(new Date(), cfg)) return
    await createBackup()
    await pruneOldBackups(cfg.retentionDays)
    await saveBackupConfig({ ...cfg, lastRun: new Date().toISOString() })
    console.log("[backup-scheduler] Sauvegarde automatique effectuée.")
  } catch (e) {
    console.error("[backup-scheduler] Échec de la sauvegarde automatique :", e)
  }
}

export function startBackupScheduler(): void {
  if (globalThis.__smthubBackupSchedulerStarted) return
  globalThis.__smthubBackupSchedulerStarted = true
  // Premier contrôle peu après le démarrage, puis toutes les 5 minutes.
  setTimeout(() => { void tick() }, 30_000)
  setInterval(() => { void tick() }, CHECK_INTERVAL_MS)
  console.log("[backup-scheduler] Planificateur de sauvegarde démarré.")
}
