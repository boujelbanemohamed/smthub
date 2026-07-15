import { promises as fs } from "fs"
import path from "path"

// Une banque = un locataire. Elle a un nom, un état actif/inactif, et la liste
// des applications que le super-admin lui a attribuées (app_ids). Les
// utilisateurs sont rattachés à une banque via leur champ `banque_id`.
export interface Bank {
  id: number
  nom: string
  actif: boolean
  app_ids: number[]
  created_at: string
}

const BANKS_FILE = path.join(process.cwd(), "data", "banks.json")
const USERS_FILE = path.join(process.cwd(), "data", "users.json")

export async function listBanks(): Promise<Bank[]> {
  try {
    const items = JSON.parse(await fs.readFile(BANKS_FILE, "utf-8"))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

async function saveBanks(items: Bank[]): Promise<void> {
  await fs.mkdir(path.dirname(BANKS_FILE), { recursive: true })
  await fs.writeFile(BANKS_FILE, JSON.stringify(items, null, 2))
}

export async function getBank(id: number): Promise<Bank | null> {
  return (await listBanks()).find((b) => b.id === id) || null
}

export async function addBank(nom: string, appIds: number[] = []): Promise<Bank | { error: string }> {
  const clean = (nom || "").trim()
  if (!clean) return { error: "Nom requis" }
  const items = await listBanks()
  if (items.some((b) => b.nom.toLowerCase() === clean.toLowerCase())) {
    return { error: "Une banque avec ce nom existe déjà" }
  }
  const bank: Bank = {
    id: Math.max(0, ...items.map((b) => b.id)) + 1,
    nom: clean,
    actif: true,
    app_ids: Array.isArray(appIds) ? appIds.map(Number).filter((n) => !Number.isNaN(n)) : [],
    created_at: new Date().toISOString(),
  }
  items.push(bank)
  await saveBanks(items)
  return bank
}

// Met à jour nom / applications attribuées / état actif. Si la banque passe à
// « inactif », on applique la même cascade que la suppression (voir plus bas).
export async function updateBank(
  id: number,
  fields: { nom?: string; app_ids?: number[]; actif?: boolean }
): Promise<Bank | { error: string }> {
  const items = await listBanks()
  const bank = items.find((b) => b.id === id)
  if (!bank) return { error: "Banque introuvable" }

  if (typeof fields.nom === "string" && fields.nom.trim()) {
    const clean = fields.nom.trim()
    if (items.some((b) => b.id !== id && b.nom.toLowerCase() === clean.toLowerCase())) {
      return { error: "Une banque avec ce nom existe déjà" }
    }
    bank.nom = clean
  }
  if (Array.isArray(fields.app_ids)) {
    bank.app_ids = fields.app_ids.map(Number).filter((n) => !Number.isNaN(n))
  }

  const wasActive = bank.actif
  if (typeof fields.actif === "boolean") bank.actif = fields.actif

  await saveBanks(items)

  // Désactivation → cascade sur les utilisateurs (comptes désactivés, détachés,
  // et rôle admin ramené à utilisateur).
  if (wasActive && bank.actif === false) {
    await cascadeDetachUsers(id)
  }
  return bank
}

// Supprime une banque. Ses utilisateurs sont désactivés, détachés, et leur
// rôle admin est ramené à « utilisateur ».
export async function deleteBank(id: number): Promise<boolean> {
  const items = await listBanks()
  if (!items.some((b) => b.id === id)) return false
  await cascadeDetachUsers(id)
  await saveBanks(items.filter((b) => b.id !== id))
  return true
}

// Applique la règle métier : pour chaque utilisateur de la banque `id`, on
// désactive son compte, on le détache de la banque, et si son rôle était
// « admin » on le repasse « utilisateur » (pour ne pas créer un super-admin).
async function cascadeDetachUsers(id: number): Promise<void> {
  let users: any[]
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
  } catch {
    return
  }
  let changed = false
  for (const u of users) {
    if (u.banque_id === id) {
      u.actif = false
      u.banque_id = null
      if (u.role === "admin") u.role = "utilisateur"
      changed = true
    }
  }
  if (changed) await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

// Ids des utilisateurs appartenant à une banque (sert au cloisonnement des
// statistiques, présence, activité…).
export async function bankUserIds(banqueId: number): Promise<Set<number>> {
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
    return new Set(users.filter((u: any) => u.banque_id === banqueId).map((u: any) => u.id))
  } catch {
    return new Set()
  }
}
