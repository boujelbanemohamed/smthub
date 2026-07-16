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
export interface SimpleApp { id: number; nom: string; category?: string }

export interface TimePoint { date: string; count: number }
export interface HourPoint { hour: number; count: number }
export interface CategoryStat { category: string; count: number }
export interface AppUsage { appId: number; nom: string; category: string; count: number }

export interface AggregatedStats {
  totalOpens: number
  topApps: AppStat[]
  topUsers: UserStat[]
  byBank: BankStat[]
  bankDetails: BankDetail[]
  activeBanks: number
  firstOpen: string | null
  lastOpen: string | null
  // Séries pour les graphiques
  timeline: TimePoint[]
  byHour: HourPoint[]
  byCategory: CategoryStat[]
  // Usage par application (toutes les applis du périmètre, y compris à 0) pour
  // repérer les applications jamais/peu utilisées.
  appUsage: AppUsage[]
}

const HORS_BANQUE = "Hors banque"

// `opens` : lignes de log déjà filtrées (action = "Ouverture application",
// filtres date/utilisateur/banque appliqués en amont).
export function aggregate(opens: any[], users: SimpleUser[], banks: SimpleBank[], apps: SimpleApp[] = []): AggregatedStats {
  const userBank = new Map<number, number | null>()
  const userName = new Map<number, string>()
  for (const u of users) {
    userBank.set(u.id, u.banque_id ?? null)
    userName.set(u.id, u.nom)
  }
  const appCategory = new Map<number, string>()
  for (const a of apps) appCategory.set(a.id, (a.category || "").trim())
  const bankName = new Map<number, string>()
  for (const b of banks) bankName.set(b.id, b.nom)

  const byApp = new Map<number, AppStat>()
  const byUser = new Map<number, UserStat>()
  const byBank = new Map<string, BankStat>() // clé : id de banque ou "null"
  const byBankApp = new Map<string, Map<number, AppStat>>()
  const byDay = new Map<string, number>() // "YYYY-MM-DD" → count
  const hours = new Array(24).fill(0) as number[]
  const byCat = new Map<string, number>()

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

    // Séries temporelles
    const d = new Date(l.timestamp)
    if (!Number.isNaN(d.getTime())) {
      const day = d.toISOString().slice(0, 10)
      byDay.set(day, (byDay.get(day) || 0) + 1)
      hours[d.getHours()]++
    }
    // Par catégorie (catégorie de l'application ouverte)
    const cat = appCategory.get(appId) || "Sans catégorie"
    byCat.set(cat, (byCat.get(cat) || 0) + 1)
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

  // Courbe temporelle triée par date croissante
  const timeline: TimePoint[] = Array.from(byDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  // Répartition par heure (0→23), toujours 24 points
  const byHour: HourPoint[] = hours.map((count, hour) => ({ hour, count }))
  // Par catégorie, triée par volume décroissant
  const byCategory: CategoryStat[] = Array.from(byCat.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
  // Usage par application : toutes les applis du périmètre (0 inclus), du moins
  // au plus utilisé (les jamais/peu utilisées d'abord).
  const appUsage: AppUsage[] = apps
    .map((a) => ({ appId: a.id, nom: a.nom, category: (a.category || "").trim() || "Sans catégorie", count: byApp.get(a.id)?.count || 0 }))
    .sort((x, y) => x.count - y.count)

  return {
    totalOpens: opens.length,
    topApps,
    topUsers,
    byBank: bankRanking,
    bankDetails: details,
    activeBanks: banks.filter((b) => b.actif !== false).length,
    firstOpen,
    lastOpen,
    timeline,
    byHour,
    byCategory,
    appUsage,
  }
}
