import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { addBank, listBanks } from "@/lib/banks-store"
import { logAction } from "@/lib/logger"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")
const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")
const APPLICATIONS_FILE = path.join(process.cwd(), "data", "applications.json")

async function readJson(file: string): Promise<any[]> {
  try { return JSON.parse(await fs.readFile(file, "utf-8")) } catch { return [] }
}
async function writeJson(file: string, data: any[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

// Génère un mot de passe temporaire lisible.
function tempPassword(): string {
  return "Smt-" + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89)
}

// POST { config } → crée une NOUVELLE banque à partir d'un export. Les applis
// sont réattribuées (ids existants), les utilisateurs recréés avec un mot de
// passe temporaire (renvoyé pour communication). Super-admin uniquement.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    const body = await request.json().catch(() => null)
    const config = body?.config ?? body
    if (!config || config._type !== "smthub-bank-config" || !config.bank) {
      return NextResponse.json({ error: "Fichier de configuration invalide" }, { status: 400 })
    }

    // Nom unique : ajoute un suffixe si le nom existe déjà.
    const banks = await listBanks()
    let nom = String(body?.newName || config.bank.nom || "Banque importée").trim()
    if (banks.some((b) => b.nom.toLowerCase() === nom.toLowerCase())) {
      let n = 2
      while (banks.some((b) => b.nom.toLowerCase() === `${nom} (${n})`.toLowerCase())) n++
      nom = `${nom} (${n})`
    }

    // N'attribue que des applications qui existent réellement.
    const apps = await readJson(APPLICATIONS_FILE)
    const existingAppIds = new Set(apps.map((a: any) => a.id))
    const appIds = (Array.isArray(config.bank.app_ids) ? config.bank.app_ids : []).filter((x: any) => existingAppIds.has(Number(x))).map(Number)

    const created = await addBank(nom, appIds, config.bank.logo_url ?? null, config.bank.theme_color ?? null)
    if ("error" in created) return NextResponse.json({ error: created.error }, { status: 400 })

    // Recrée les utilisateurs (email en conflit = ignoré) et leurs accès.
    const users = await readJson(USERS_FILE)
    const access = await readJson(ACCESS_FILE)
    const existingEmails = new Set(users.map((u: any) => String(u.email).toLowerCase()))
    let nextId = Math.max(0, ...users.map((u: any) => u.id)) + 1

    const createdUsers: { nom: string; email: string; role: string; tempPassword: string }[] = []
    const skipped: string[] = []
    const bankAppIds = new Set(created.app_ids)

    for (const u of Array.isArray(config.users) ? config.users : []) {
      const email = String(u.email || "").trim()
      if (!email || existingEmails.has(email.toLowerCase())) { skipped.push(email || "(email manquant)"); continue }
      const pwd = tempPassword()
      const role = u.role === "admin" ? "admin" : "utilisateur"
      const id = nextId++
      users.push({
        id,
        nom: u.nom || email,
        email,
        mot_de_passe: await bcrypt.hash(pwd, 10),
        role,
        avatar: null,
        banque_id: created.id,
        actif: u.actif !== false,
        ...(role === "admin" ? { access_initialized: true } : {}),
      })
      existingEmails.add(email.toLowerCase())
      // Accès individuels : bornés aux applis de la banque.
      const grantIds = (Array.isArray(u.app_ids) ? u.app_ids : []).map(Number).filter((a: number) => bankAppIds.has(a))
      for (const aid of grantIds) {
        if (!access.some((x: any) => x.utilisateur_id === id && x.application_id === aid)) {
          access.push({ utilisateur_id: id, application_id: aid })
        }
      }
      createdUsers.push({ nom: u.nom || email, email, role, tempPassword: pwd })
    }

    await writeJson(USERS_FILE, users)
    await writeJson(ACCESS_FILE, access)
    await logAction("Import banque", `Banque importée: ${created.nom} (${createdUsers.length} utilisateur(s), ${skipped.length} ignoré(s))`, "INFO", admin.id, admin.nom)

    return NextResponse.json({ bank: created, createdUsers, skipped }, { status: 201 })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
