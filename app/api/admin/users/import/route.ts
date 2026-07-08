import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { requireAdmin, authErrorResponse, isValidEmail } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseCsv } from "@/lib/csv"
import { logUserAction } from "@/lib/logger"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

interface User {
  id: number
  nom: string
  email: string
  mot_de_passe: string
  role: "admin" | "utilisateur"
  avatar?: string | null
}

// POST { csv } → importe des utilisateurs. Colonnes : nom,email,role[,mot_de_passe]
// Un mot de passe vide → mot de passe aléatoire (à réinitialiser ensuite).
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { csv } = await request.json()
    if (typeof csv !== "string" || !csv.trim()) {
      return NextResponse.json({ error: "Fichier CSV vide" }, { status: 400 })
    }

    const parsed = parseCsv(csv)
    if (parsed.length === 0) {
      return NextResponse.json({ error: "Aucune ligne exploitable" }, { status: 400 })
    }

    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL

    let existing: User[] = []
    if (!usePostgres) {
      try {
        existing = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
      } catch {
        existing = []
      }
    }

    let created = 0
    const errors: string[] = []

    for (let i = 0; i < parsed.length; i++) {
      const line = i + 2 // +1 en-tête, +1 base 1
      const nom = (parsed[i].nom || "").trim()
      const email = (parsed[i].email || "").trim().toLowerCase()
      const roleRaw = (parsed[i].role || "utilisateur").trim().toLowerCase()
      const role = roleRaw === "admin" ? "admin" : "utilisateur"
      const providedPwd = (parsed[i].mot_de_passe || "").trim()

      if (!nom || !email) {
        errors.push(`Ligne ${line} : nom et email requis`)
        continue
      }
      if (!isValidEmail(email)) {
        errors.push(`Ligne ${line} : email invalide (${email})`)
        continue
      }

      const password = providedPwd || crypto.randomBytes(9).toString("base64")
      const hashed = await bcrypt.hash(password, 10)

      try {
        if (usePostgres) {
          const exists = await prisma.user.findUnique({ where: { email } })
          if (exists) {
            errors.push(`Ligne ${line} : email déjà existant (${email})`)
            continue
          }
          await prisma.user.create({ data: { nom, email, role, mot_de_passe: hashed } })
        } else {
          if (existing.some((u) => u.email === email)) {
            errors.push(`Ligne ${line} : email déjà existant (${email})`)
            continue
          }
          const newId = existing.reduce((m, u) => Math.max(m, u.id), 0) + 1
          existing.push({ id: newId, nom, email, role, mot_de_passe: hashed })
        }
        created++
      } catch (e) {
        errors.push(`Ligne ${line} : erreur (${e instanceof Error ? e.message : "inconnue"})`)
      }
    }

    if (!usePostgres) {
      await fs.mkdir(path.dirname(USERS_FILE), { recursive: true })
      await fs.writeFile(USERS_FILE, JSON.stringify(existing, null, 2))
    }

    await logUserAction("Import utilisateurs", admin.id, admin.nom, `${created} utilisateur(s) importé(s), ${errors.length} erreur(s)`)

    return NextResponse.json({ created, errors })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur lors de l'import" }, { status: 500 })
  }
}
