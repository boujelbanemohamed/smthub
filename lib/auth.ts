import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { verifySession, signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session"
import { findUserByEmail } from "@/lib/user-store"

/**
 * Si l'erreur provient de requireAuth/requireAdmin, renvoie la réponse HTTP
 * adaptée (401 non authentifié / 403 accès refusé). Sinon renvoie null pour
 * laisser l'appelant gérer une erreur serveur générique.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "Authentication required") {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  if (error instanceof Error && (error.message === "Admin access required" || error.message === "Super admin required")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
  }
  return null
}

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
  avatar?: string | null
  // Multi-banques : rattachement à une banque (null = non rattaché) et statut
  // du compte (false = désactivé, ne peut plus se connecter).
  banque_id?: number | null
  actif?: boolean
}

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

/**
 * Get the current authenticated user from session
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE_NAME)

    if (!session?.value) {
      return null
    }

    const userData = await verifySession(session.value)
    if (!userData) {
      await clearSession()
      return null
    }

    // Verify user still exists in database
    const users = await readUsers()
    const user = users.find(u => u.id === userData.id)
    
    if (!user) {
      // User was deleted, clear session
      await clearSession()
      return null
    }

    // Compte désactivé → on invalide la session immédiatement.
    if ((user as User).actif === false) {
      await clearSession()
      return null
    }

    return {
      id: user.id,
      nom: user.nom,
      email: user.email,
      role: user.role,
      avatar: (user as User).avatar ?? null,
      banque_id: (user as User).banque_id ?? null,
      actif: (user as User).actif !== false, // absent → considéré actif
    } as User
  } catch {
    return null
  }
}

/**
 * Un super-admin est un admin SANS banque (global). Un admin AVEC banque est un
 * « admin de banque » (périmètre limité à sa banque).
 */
export function isSuperAdmin(user: { role: string; banque_id?: number | null } | null | undefined): boolean {
  return !!user && user.role === "admin" && (user.banque_id == null)
}
export function isBankAdmin(user: { role: string; banque_id?: number | null } | null | undefined): boolean {
  return !!user && user.role === "admin" && user.banque_id != null
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Check if user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === "admin"
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Authentication required")
  }
  return user
}

/**
 * Require admin role - throws error if not admin
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== "admin") {
    throw new Error("Admin access required")
  }
  return user
}

/**
 * Exige un SUPER-admin (admin global, sans banque). Les admins de banque sont
 * refusés — sert à protéger les fonctions réservées au super-admin
 * (applications, catégories, sauvegardes, banques, logs complets…).
 */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireAdmin()
  if (user.banque_id != null) {
    // On réutilise le message standard "Admin access required" pour que tous
    // les gestionnaires d'erreur existants renvoient bien un 403 (accès refusé).
    throw new Error("Admin access required")
  }
  return user
}

/**
 * Revérifie le mot de passe de l'utilisateur actuellement connecté.
 * Sert à confirmer l'identité avant une action sensible (ex. téléchargement
 * ou suppression d'un dépôt de code). Renvoie true seulement si le mot de
 * passe correspond bien au compte de la session en cours.
 */
export async function verifyCurrentUserPassword(password: string): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0) return false
  const current = await getCurrentUser()
  if (!current) return false
  const stored = await findUserByEmail(current.email)
  if (!stored?.mot_de_passe) return false
  return bcrypt.compare(password, stored.mot_de_passe)
}

/**
 * Clear user session
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Update user session with new data
 */
export async function updateSession(user: User): Promise<void> {
  const cookieStore = await cookies()
  const token = await signSession({
    id: user.id,
    nom: user.nom,
    email: user.email,
    role: user.role,
  })
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
  })
}

/**
 * Read users from file
 */
async function readUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: "Le mot de passe doit contenir au moins 6 caractères" }
  }
  
  if (password.length > 128) {
    return { valid: false, message: "Le mot de passe ne peut pas dépasser 128 caractères" }
  }
  
  return { valid: true }
}

/**
 * Sanitize user input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, "")
}

/**
 * Rate limiting helper (implémentation en mémoire, par instance).
 *
 * ⚠️ Limite connue : ce compteur vit dans la mémoire du processus. Il est donc
 * remis à zéro à chaque redémarrage et n'est PAS partagé entre plusieurs
 * instances (serverless, multi-pods). Pour un déploiement distribué, remplacer
 * le stockage par un magasin externe (Redis, Upstash...). Voir PRODUCTION.md.
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
let lastCleanup = 0
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

// Évince les entrées expirées pour éviter une croissance mémoire non bornée.
function cleanupExpired(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

export function checkRateLimit(identifier: string, maxRequests: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
  cleanupExpired(now)
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}
