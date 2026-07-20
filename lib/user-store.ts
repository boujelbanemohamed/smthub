import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"

/**
 * Accès au magasin d'utilisateurs (mode fichier JSON ou PostgreSQL),
 * factorisé pour les flux d'authentification (mot de passe oublié, etc.).
 */
const USERS_FILE = path.join(process.cwd(), "data", "users.json")

export interface StoredUser {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
  avatar?: string | null
}

/**
 * Valide une valeur d'avatar : image téléversée (/uploads/...) ou préréglage
 * couleur (color:#rrggbb). Toute autre valeur renvoie `undefined` (ignorée),
 * ce qui empêche d'injecter une URL externe arbitraire.
 */
export function sanitizeAvatar(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== "string") return undefined
  if (value.startsWith("/uploads/")) return value
  if (/^color:#[0-9a-fA-F]{6}$/.test(value)) return value
  return undefined
}

function usePostgres(): boolean {
  return process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
  } catch {
    return []
  }
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true })
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  if (usePostgres()) {
    try {
      return (await prisma.user.findUnique({ where: { email } })) as StoredUser | null
    } catch (e) {
      console.error("Prisma findUserByEmail, repli JSON:", e)
    }
  }
  const users = await readUsers()
  return users.find((u) => u.email === email) || null
}

export async function setUserPassword(userId: number, hashedPassword: string): Promise<boolean> {
  if (usePostgres()) {
    await prisma.user.update({ where: { id: userId }, data: { mot_de_passe: hashedPassword } })
    return true
  }
  const users = await readUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return false
  users[index].mot_de_passe = hashedPassword
  await writeUsers(users)
  return true
}

// Active / désactive un compte. Utilisé notamment par la désactivation
// automatique en cas de non-conformité du mot de passe après le délai de grâce.
export async function setUserActive(userId: number, actif: boolean): Promise<boolean> {
  if (usePostgres()) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { actif } })
      return true
    } catch (e) {
      console.error("Prisma setUserActive, repli JSON:", e)
    }
  }
  const users = await readUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return false
  ;(users[index] as any).actif = actif
  await writeUsers(users)
  return true
}
