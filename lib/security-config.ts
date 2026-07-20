import { promises as fs } from "fs"
import path from "path"

// Configuration de sécurité pilotée par le super-admin (Admin → Sécurité).
// Toutes les protections sont DÉSACTIVÉES par défaut : la plateforme se
// comporte exactement comme avant tant que le super-admin n'active rien.

export interface PasswordPolicy {
  enabled: boolean
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireDigit: boolean
  requireSpecial: boolean
  expiryDays: number // 0 = pas d'expiration
  historyCount: number // interdiction de réutiliser les N derniers (0 = off)
  graceHours: number // délai de mise en conformité avant désactivation
}

export interface LockoutPolicy {
  enabled: boolean
  maxAttempts: number // nombre d'échecs avant verrouillage
  lockMinutes: number // durée du verrouillage
}

export interface TwoFactorPolicy {
  totpEnabled: boolean // application d'authentification (Google Authenticator…)
  emailEnabled: boolean // code envoyé par email
}

export interface SecurityConfig {
  passwordPolicy: PasswordPolicy
  lockout: LockoutPolicy
  twoFactor: TwoFactorPolicy
}

const FILE = path.join(process.cwd(), "data", "security-config.json")

export const DEFAULT_SECURITY: SecurityConfig = {
  passwordPolicy: {
    enabled: false,
    minLength: 10,
    requireUpper: true,
    requireLower: true,
    requireDigit: true,
    requireSpecial: true,
    expiryDays: 90,
    historyCount: 3,
    graceHours: 48,
  },
  lockout: {
    enabled: false,
    maxAttempts: 5,
    lockMinutes: 60,
  },
  twoFactor: {
    totpEnabled: false,
    emailEnabled: false,
  },
}

function merge(raw: any): SecurityConfig {
  const d = DEFAULT_SECURITY
  const r = raw && typeof raw === "object" ? raw : {}
  return {
    passwordPolicy: { ...d.passwordPolicy, ...(r.passwordPolicy || {}) },
    lockout: { ...d.lockout, ...(r.lockout || {}) },
    twoFactor: { ...d.twoFactor, ...(r.twoFactor || {}) },
  }
}

export async function getSecurityConfig(): Promise<SecurityConfig> {
  try {
    return merge(JSON.parse(await fs.readFile(FILE, "utf-8")))
  } catch {
    return { ...DEFAULT_SECURITY }
  }
}

export async function setSecurityConfig(patch: Partial<SecurityConfig>): Promise<SecurityConfig> {
  const cur = await getSecurityConfig()
  const next: SecurityConfig = {
    passwordPolicy: { ...cur.passwordPolicy, ...(patch.passwordPolicy || {}) },
    lockout: { ...cur.lockout, ...(patch.lockout || {}) },
    twoFactor: { ...cur.twoFactor, ...(patch.twoFactor || {}) },
  }
  // Garde-fous : valeurs numériques bornées et cohérentes.
  next.passwordPolicy.minLength = clamp(next.passwordPolicy.minLength, 6, 64)
  next.passwordPolicy.expiryDays = clamp(next.passwordPolicy.expiryDays, 0, 3650)
  next.passwordPolicy.historyCount = clamp(next.passwordPolicy.historyCount, 0, 24)
  next.passwordPolicy.graceHours = clamp(next.passwordPolicy.graceHours, 1, 720)
  next.lockout.maxAttempts = clamp(next.lockout.maxAttempts, 1, 50)
  next.lockout.lockMinutes = clamp(next.lockout.lockMinutes, 1, 1440)
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(next, null, 2))
  return next
}

function clamp(n: any, min: number, max: number): number {
  const v = Number(n)
  if (Number.isNaN(v)) return min
  return Math.max(min, Math.min(max, Math.round(v)))
}

// Évalue un mot de passe EN CLAIR contre la politique. Retourne la liste des
// règles non respectées (vide = conforme).
export function evaluatePassword(password: string, policy: PasswordPolicy): string[] {
  const problems: string[] = []
  if (!policy.enabled) return problems
  if ((password || "").length < policy.minLength)
    problems.push(`au moins ${policy.minLength} caractères`)
  if (policy.requireUpper && !/[A-Z]/.test(password)) problems.push("une majuscule")
  if (policy.requireLower && !/[a-z]/.test(password)) problems.push("une minuscule")
  if (policy.requireDigit && !/[0-9]/.test(password)) problems.push("un chiffre")
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password))
    problems.push("un caractère spécial")
  return problems
}
