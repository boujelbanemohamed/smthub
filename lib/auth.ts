import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
}

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

/**
 * Get the current authenticated user from session
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = cookies()
    const session = cookieStore.get("user-session")
    
    if (!session?.value) {
      return null
    }

    const userData = JSON.parse(session.value)
    
    // Verify user still exists in database
    const users = await readUsers()
    const user = users.find(u => u.id === userData.id)
    
    if (!user) {
      // User was deleted, clear session
      await clearSession()
      return null
    }

    return {
      id: user.id,
      nom: user.nom,
      email: user.email,
      role: user.role
    } as User
  } catch {
    return null
  }
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
 * Clear user session
 */
export async function clearSession(): Promise<void> {
  const cookieStore = cookies()
  cookieStore.delete("user-session")
}

/**
 * Update user session with new data
 */
export async function updateSession(user: User): Promise<void> {
  const cookieStore = cookies()
  cookieStore.set(
    "user-session",
    JSON.stringify({
      id: user.id,
      nom: user.nom,
      email: user.email,
      role: user.role,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
    },
  )
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
 * Rate limiting helper (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(identifier: string, maxRequests: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
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

/**
 * Generate secure session token
 */
export function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
