import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { logUserAction, logError } from "@/lib/logger"
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session"
import { touchLastLogin } from "@/lib/presence-store"
import { verifyPending } from "@/lib/twofa-token"
import {
  getSecret,
  confirmTotp,
  verifyEmailOtp,
  generateBackupCodes,
  consumeBackupCode,
} from "@/lib/two-factor-store"
import { verifyTotp } from "@/lib/totp"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

async function findUserById(id: number): Promise<any | null> {
  const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
  if (usePostgres) {
    try {
      const u = await prisma.user.findUnique({ where: { id } })
      if (u) return u
    } catch { /* repli JSON */ }
  }
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
    return users.find((u: any) => u.id === id) || null
  } catch {
    return null
  }
}

// POST { pendingToken, code } → valide le second facteur et ouvre la session.
export async function POST(request: NextRequest) {
  try {
    const { pendingToken, code } = await request.json().catch(() => ({}))
    if (!pendingToken || !code) {
      return NextResponse.json({ error: "Code requis" }, { status: 400 })
    }
    const p = await verifyPending(pendingToken)
    if (!p) {
      return NextResponse.json({ error: "Session expirée, reconnectez-vous." }, { status: 401 })
    }
    const user = await findUserById(p.uid)
    if (!user || user.actif === false) {
      return NextResponse.json({ error: "Compte indisponible." }, { status: 403 })
    }

    let ok = false
    let usedBackup = false

    if (p.method === "totp") {
      const secret = await getSecret(p.uid)
      if (secret) ok = verifyTotp(secret, String(code))
      // Repli : code de secours accepté à la place du code TOTP.
      if (!ok && (await consumeBackupCode(p.uid, String(code)))) {
        ok = true
        usedBackup = true
      }
      if (ok && p.stage === "enroll_totp" && !usedBackup) {
        // Première validation → on confirme l'enrôlement et on génère les codes
        // de secours (renvoyés une seule fois).
        await confirmTotp(p.uid)
      }
    } else if (p.method === "email") {
      ok = await verifyEmailOtp(p.uid, String(code))
    }

    if (!ok) {
      await logError("2FA", `Code 2FA invalide: ${user.email}`, "Code incorrect", user.id, user.nom)
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 401 })
    }

    // Codes de secours : générés à la fin d'un enrôlement TOTP réussi.
    let backupCodes: string[] | undefined
    if (p.method === "totp" && p.stage === "enroll_totp" && !usedBackup) {
      backupCodes = await generateBackupCodes(p.uid)
    }

    // Ouverture de la session.
    const sessionData = { id: user.id, nom: user.nom, email: user.email, role: user.role }
    const token = await signSession(sessionData)
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    })
    await touchLastLogin(user.id)
    await logUserAction("Login", user.id, user.nom, `Connexion réussie (2FA ${p.method}): ${user.email}`)

    return NextResponse.json({ success: true, user: sessionData, backupCodes })
  } catch (error) {
    console.error("Erreur vérification 2FA:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
