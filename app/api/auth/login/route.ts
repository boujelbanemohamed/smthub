import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logError, logUserAction } from "@/lib/logger"
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session"
import { touchLastLogin } from "@/lib/presence-store"
import { checkRateLimit } from "@/lib/auth"
import { getSecurityConfig, evaluatePassword } from "@/lib/security-config"
import { getLockState, recordFailure, clearFailures } from "@/lib/login-attempts"
import { ensureChangedAt, ensureGrace } from "@/lib/password-security"
import { setUserActive } from "@/lib/user-store"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

async function readUsers(): Promise<any[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!checkRateLimit(`login:${clientIp}:${email}`)) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      )
    }

    // Configuration de sécurité (verrouillage / politique de mot de passe).
    const security = await getSecurityConfig()

    // Verrouillage de compte : refus immédiat si le compte est verrouillé.
    if (security.lockout.enabled) {
      const lock = await getLockState(email)
      if (lock.locked) {
        await logError("Login", `Connexion refusée (compte verrouillé): ${email}`, "Compte verrouillé")
        return NextResponse.json(
          {
            error: `Compte verrouillé suite à trop de tentatives. Réessayez dans ${lock.minutesLeft} min ou contactez votre administrateur.`,
            locked: true,
            minutesLeft: lock.minutesLeft,
          },
          { status: 403 }
        )
      }
    }

    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL

    let user: any | null = null
    if (usePostgres) {
      try {
        user = await prisma.user.findUnique({ where: { email } })
      } catch (e) {
        console.error("Erreur Prisma (login), fallback JSON:", e)
      }
    }
    if (!user) {
      const users = await readUsers()
      user = users.find((u) => u.email === email) || null
    }

    if (!user) {
      await logError("Login", `Echec connexion: ${email}`, "Email inconnu")
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      )
    }

    // Vérification du mot de passe : uniquement via bcrypt. Un mot de passe
    // stocké en clair (hash invalide) renvoie false → jamais accepté.
    const stored = user.mot_de_passe || ""
    const isValidPassword = stored ? await bcrypt.compare(password, stored) : false

    if (!isValidPassword) {
      await logError("Login", `Echec connexion: ${email}`, "Mot de passe incorrect", user?.id, user?.nom)
      // Verrouillage : on comptabilise l'échec pour les comptes existants.
      if (security.lockout.enabled) {
        const res = await recordFailure(email, security.lockout.maxAttempts, security.lockout.lockMinutes)
        if (res.locked) {
          await logError("Login", `Compte verrouillé: ${email}`, "Seuil de tentatives atteint", user?.id, user?.nom)
          return NextResponse.json(
            {
              error: `Compte verrouillé suite à trop de tentatives. Réessayez dans ${res.minutesLeft} min ou contactez votre administrateur.`,
              locked: true,
              minutesLeft: res.minutesLeft,
            },
            { status: 403 }
          )
        }
        return NextResponse.json(
          {
            error: "Email ou mot de passe incorrect",
            remaining: res.remaining,
          },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      )
    }

    // Compte désactivé (ex. banque supprimée/désactivée) → connexion refusée.
    if (user.actif === false) {
      await logError("Login", `Echec connexion (compte désactivé): ${email}`, "Compte désactivé", user?.id, user?.nom)
      return NextResponse.json(
        { error: "Votre compte est désactivé. Veuillez contacter l'administrateur." },
        { status: 403 }
      )
    }

    // Connexion réussie côté mot de passe → on efface le compteur d'échecs.
    if (security.lockout.enabled) await clearFailures(email)

    // --- Politique de mot de passe (conformité + expiration) ---
    // On évalue le mot de passe EN CLAIR (disponible ici) contre la politique.
    let passwordWarning: { mustChange: boolean; graceUntil: string; reasons: string[] } | null = null
    if (security.passwordPolicy.enabled) {
      const pol = security.passwordPolicy
      const problems = evaluatePassword(password, pol)
      const changedAt = await ensureChangedAt(user.id)
      const expired =
        pol.expiryDays > 0 &&
        Date.now() - new Date(changedAt).getTime() > pol.expiryDays * 24 * 3600 * 1000
      const reasons = [...problems]
      if (expired) reasons.push("mot de passe expiré")

      if (reasons.length > 0) {
        const graceUntil = await ensureGrace(user.id, pol.graceHours)
        if (Date.now() > new Date(graceUntil).getTime()) {
          // Délai de grâce dépassé → désactivation automatique du compte.
          await setUserActive(user.id, false)
          await logError(
            "Login",
            `Compte désactivé (non-conformité mot de passe): ${email}`,
            reasons.join(", "),
            user.id,
            user.nom
          )
          return NextResponse.json(
            {
              error:
                "Votre compte a été désactivé : le mot de passe n'a pas été mis en conformité dans le délai imparti. Contactez votre administrateur.",
            },
            { status: 403 }
          )
        }
        // Sinon on laisse entrer, mais on signale l'obligation de changement.
        passwordWarning = { mustChange: true, graceUntil, reasons }
      }
    }

    // Créer une session
    const sessionData = {
      id: user.id,
      nom: user.nom,
      email: user.email,
      role: user.role,
    }

    const token = await signSession(sessionData)
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    })

    await touchLastLogin(user.id)
    await logUserAction("Login", user.id, user.nom, `Connexion réussie: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: "Connexion réussie",
      user: sessionData,
      passwordWarning,
    })
  } catch (error) {
    console.error("Erreur de connexion:", error)
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
