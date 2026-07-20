import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import type { TwoFactorPolicy } from "@/lib/security-config"

// État 2FA par utilisateur (data/two-factor.json) :
//  - override : réglage imposé par le super-admin pour CE compte
//  - totpSecret / totpEnabled : enrôlement de l'application d'authentification
//  - backupCodes : codes de secours (hashés)
//  - emailOtp : code email temporaire (hashé) en cours de vérification

export type TwoFactorOverride = "inherit" | "totp" | "email" | "disabled"
export type EffectiveMethod = "none" | "totp" | "email"

export interface UserTwoFactor {
  override?: TwoFactorOverride
  totpSecret?: string | null
  totpEnabled?: boolean
  backupCodes?: string[]
  emailOtp?: { hash: string; expires: string; attempts: number } | null
}

const FILE = path.join(process.cwd(), "data", "two-factor.json")

async function readAll(): Promise<Record<string, UserTwoFactor>> {
  try {
    const d = JSON.parse(await fs.readFile(FILE, "utf-8"))
    return d && typeof d === "object" ? d : {}
  } catch {
    return {}
  }
}

async function writeAll(data: Record<string, UserTwoFactor>): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(data, null, 2))
}

export async function getUser2FA(userId: number): Promise<UserTwoFactor> {
  const all = await readAll()
  return all[String(userId)] || { override: "inherit" }
}

async function patch(userId: number, p: Partial<UserTwoFactor>): Promise<UserTwoFactor> {
  const all = await readAll()
  const cur = all[String(userId)] || {}
  const next = { ...cur, ...p }
  all[String(userId)] = next
  await writeAll(all)
  return next
}

// --- Réglage super-admin par utilisateur ---
export async function setOverride(userId: number, override: TwoFactorOverride): Promise<void> {
  // Changer d'override (ou désactiver) réinitialise l'enrôlement TOTP existant
  // pour forcer une nouvelle configuration propre le cas échéant.
  if (override === "disabled" || override === "email") {
    await patch(userId, { override, totpSecret: null, totpEnabled: false, backupCodes: [] })
  } else {
    await patch(userId, { override })
  }
}

// Méthode 2FA effective = override utilisateur, sinon politique globale.
// La 2FA est obligatoire : dès qu'une méthode globale est active, elle
// s'applique à tous (sauf override « disabled »).
export function resolveMethod(policy: TwoFactorPolicy, override?: TwoFactorOverride): EffectiveMethod {
  const ov = override || "inherit"
  if (ov === "disabled") return "none"
  if (ov === "totp") return "totp"
  if (ov === "email") return "email"
  // hérite de la politique globale (TOTP prioritaire si les deux sont actives)
  if (policy.totpEnabled) return "totp"
  if (policy.emailEnabled) return "email"
  return "none"
}

// --- Enrôlement TOTP ---
export async function setPendingSecret(userId: number, secret: string): Promise<void> {
  await patch(userId, { totpSecret: secret, totpEnabled: false })
}
export async function confirmTotp(userId: number): Promise<void> {
  await patch(userId, { totpEnabled: true })
}
export async function isTotpEnrolled(userId: number): Promise<boolean> {
  const m = await getUser2FA(userId)
  return !!(m.totpEnabled && m.totpSecret)
}
export async function getSecret(userId: number): Promise<string | null> {
  const m = await getUser2FA(userId)
  return m.totpSecret || null
}
export async function disableTotp(userId: number): Promise<void> {
  await patch(userId, { totpSecret: null, totpEnabled: false, backupCodes: [] })
}

// --- Codes de secours ---
export async function generateBackupCodes(userId: number): Promise<string[]> {
  const codes: string[] = []
  for (let i = 0; i < 8; i++) {
    codes.push(Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase())
  }
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)))
  await patch(userId, { backupCodes: hashes })
  return codes // en clair une seule fois, à afficher à l'utilisateur
}
export async function consumeBackupCode(userId: number, code: string): Promise<boolean> {
  const all = await readAll()
  const meta = all[String(userId)]
  if (!meta?.backupCodes?.length) return false
  for (let i = 0; i < meta.backupCodes.length; i++) {
    if (await bcrypt.compare(code.trim().toUpperCase(), meta.backupCodes[i])) {
      meta.backupCodes.splice(i, 1)
      all[String(userId)] = meta
      await writeAll(all)
      return true
    }
  }
  return false
}

// --- Code email temporaire ---
export async function setEmailOtp(userId: number, code: string, ttlMinutes = 10): Promise<void> {
  const hash = await bcrypt.hash(code, 10)
  await patch(userId, {
    emailOtp: { hash, expires: new Date(Date.now() + ttlMinutes * 60000).toISOString(), attempts: 0 },
  })
}
export async function verifyEmailOtp(userId: number, code: string): Promise<boolean> {
  const all = await readAll()
  const meta = all[String(userId)]
  const otp = meta?.emailOtp
  if (!otp) return false
  if (Date.now() > new Date(otp.expires).getTime()) return false
  if (otp.attempts >= 5) return false
  const ok = await bcrypt.compare(code.trim(), otp.hash)
  if (ok) {
    meta.emailOtp = null
    all[String(userId)] = meta
    await writeAll(all)
    return true
  }
  otp.attempts += 1
  all[String(userId)] = meta
  await writeAll(all)
  return false
}

// Liste des overrides (pour l'affichage dans la liste des utilisateurs).
export async function listOverrides(): Promise<Record<string, { override: TwoFactorOverride; enrolled: boolean }>> {
  const all = await readAll()
  const out: Record<string, { override: TwoFactorOverride; enrolled: boolean }> = {}
  for (const [uid, m] of Object.entries(all)) {
    out[uid] = { override: (m.override as TwoFactorOverride) || "inherit", enrolled: !!(m.totpEnabled && m.totpSecret) }
  }
  return out
}
