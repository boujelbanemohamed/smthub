// Agrégation des statistiques d'usage à partir des ouvertures d'applications.
// Mutualisée entre l'API (/api/admin/stats, lue par le PDF) et l'export Excel,
// pour garantir des chiffres identiques partout.

export interface AppStat { appId: number; nom: string; count: number }
export interface UserStat { userId: number; nom: string; count: number }
export interface BankStat { banqueId: number | null; nom: string; count: number }
export interface BankDetail {
  banqueId: number | null
  nom: string
  count: number
  topApps: AppStat[]
  users: UserStat[]
}

export interface SimpleUser { id: number; nom: string; banque_id?: number | null }
export interface SimpleBank { id: number; nom: string; actif?: boolean }

export interface AggregatedStats {
  totalOpens: number
  topApps: AppStat[]
  topUsers: UserStat[]
  byBank: BankStat[]
  bankDetails: BankDetail[]
  activeBanks: number
  firstOpen: string | null
  lastOpen: string | null
}

const HORS_BANQUE = "Hors banque"

// `opens` : lignes de log déjà filtrées (action = "Ouverture application",
// filtres date/utilisateur/banque appliqués en amont).
export function aggregate(opens: any[], users: SimpleUser[], banks: SimpleBank[]): AggregatedStats {
  const userBank = new Map<number, number | null>()
  const userName = new Map<number, string>()
  for (const u of users) {
    userBank.set(u.id, u.banque_id ?? null)
    userName.set(u.id, u.nom)
  }
  const bankName = new Map<number, string>()
  for (const b of banks) bankName.set(b.id, b.nom)

  const byApp = new Map<number, AppStat>()
  const byUser = new Map<number, UserStat>()
  const byBank = new Map<string, BankStat>() // clé : id de banque ou "null"
  const byBankApp = new Map<string, Map<number, AppStat>>()

  const keyOf = (bId: number | null) => (bId == null ? "null" : String(bId))
  const nameOf = (bId: number | null) => (bId == null ? HORS_BANQUE : bankName.get(bId) || `Banque ${bId}`)

  let firstOpen: string | null = null
  let lastOpen: string | null = null

  for (const l of opens) {
    const appId = l.metadata?.appId ?? -1
    const appName = l.metadata?.appName ?? `Application ${appId}`

    const a = byApp.get(appId) || { appId, nom: appName, count: 0 }
    a.count++; a.nom = appName; byApp.set(appId, a)

    const uid = typeof l.userId === "number" ? l.userId : null
    if (uid != null) {
      const u = byUser.get(uid) || { userId: uid, nom: l.userName || userName.get(uid) || `Utilisateur ${uid}`, count: 0 }
      u.count++; byUser.set(uid, u)
    }

    const bId = uid != null ? (userBank.get(uid) ?? null) : null
    const bKey = keyOf(bId)
    const bs = byBank.get(bKey) || { banqueId: bId, nom: nameOf(bId), count: 0 }
    bs.count++; byBank.set(bKey, bs)

    let apps = byBankApp.get(bKey)
    if (!apps) { apps = new Map(); byBankApp.set(bKey, apps) }
    const ba = apps.get(appId) || { appId, nom: appName, count: 0 }
    ba.count++; ba.nom = appName; apps.set(appId, ba)

    if (!firstOpen || l.timestamp < firstOpen) firstOpen = l.timestamp
    if (!lastOpen || l.timestamp > lastOpen) lastOpen = l.timestamp
  }

  const topApps = Array.from(byApp.values()).sort((x, y) => y.count - x.count)
  const topUsers = Array.from(byUser.values()).sort((x, y) => y.count - x.count)
  const bankRanking = Array.from(byBank.values()).sort((x, y) => y.count - x.count)

  // Détail par banque : toutes les banques réelles + « Hors banque » si concerné.
  // Pour chaque banque, on liste TOUS ses utilisateurs (même à 0 ouverture),
  // classés du plus actif au moins actif.
  const details: BankDetail[] = []
  const buildUsersFor = (predicate: (u: SimpleUser) => boolean): UserStat[] =>
    users
      .filter(predicate)
      .map((u) => ({ userId: u.id, nom: u.nom, count: byUser.get(u.id)?.count || 0 }))
      .sort((x, y) => y.count - x.count)

  for (const b of banks) {
    const bKey = keyOf(b.id)
    const count = byBank.get(bKey)?.count || 0
    const topAppsBank = Array.from((byBankApp.get(bKey) || new Map()).values()).sort((x, y) => y.count - x.count)
    details.push({
      banqueId: b.id,
      nom: b.nom,
      count,
      topApps: topAppsBank,
      users: buildUsersFor((u) => (u.banque_id ?? null) === b.id),
    })
  }
  // Hors banque (utilisateurs sans banque) : uniquement s'il y a des ouvertures.
  const horsCount = byBank.get("null")?.count || 0
  if (horsCount > 0) {
    const topAppsHors = Array.from((byBankApp.get("null") || new Map()).values()).sort((x, y) => y.count - x.count)
    details.push({
      banqueId: null,
      nom: HORS_BANQUE,
      count: horsCount,
      topApps: topAppsHors,
      users: buildUsersFor((u) => (u.banque_id ?? null) == null),
    })
  }

  return {
    totalOpens: opens.length,
    topApps,
    topUsers,
    byBank: bankRanking,
    bankDetails: details,
    activeBanks: banks.filter((b) => b.actif !== false).length,
    firstOpen,
    lastOpen,
  }
}
