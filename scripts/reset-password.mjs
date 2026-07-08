#!/usr/bin/env node
/**
 * Réinitialise le mot de passe d'un utilisateur EXISTANT, directement en
 * terminal (sans email/SMTP). Le rôle de l'utilisateur n'est PAS modifié.
 *
 * Variables requises :
 *   USER_EMAIL     - email du compte à réinitialiser
 *   NEW_PASSWORD   - nouveau mot de passe (au moins 6 caractères)
 *
 * Cible :
 *   - PostgreSQL si DATABASE_URL / DATABASE_TYPE=postgresql est défini
 *   - sinon fichier data/users.json
 *
 * Usage :
 *   USER_EMAIL=boujelbane@gmail.com NEW_PASSWORD='MonNouveauMdp1' npm run reset:password
 */
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"

const email = process.env.USER_EMAIL
const password = process.env.NEW_PASSWORD

if (!email || !password) {
  console.error(
    "Erreur : USER_EMAIL et NEW_PASSWORD sont requis.\n" +
      "Exemple : USER_EMAIL=vous@exemple.com NEW_PASSWORD='MonNouveauMdp1' npm run reset:password"
  )
  process.exit(1)
}

if (password.length < 6) {
  console.error("Erreur : NEW_PASSWORD doit contenir au moins 6 caractères.")
  process.exit(1)
}

const usePostgres = !!process.env.DATABASE_URL || process.env.DATABASE_TYPE === "postgresql"

async function resetJson() {
  const usersFile = path.join(process.cwd(), "data", "users.json")
  let users = []
  try {
    users = JSON.parse(await fs.readFile(usersFile, "utf-8"))
  } catch {
    console.error("Impossible de lire data/users.json")
    process.exit(1)
  }
  const user = users.find((u) => u.email === email)
  if (!user) {
    console.error(`Aucun utilisateur avec l'email ${email}.`)
    process.exit(1)
  }
  user.mot_de_passe = await bcrypt.hash(password, 10)
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2))
  console.log(`Mot de passe réinitialisé (mode fichier) pour ${email} — rôle inchangé (${user.role}).`)
}

async function resetPostgres() {
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.error(`Aucun utilisateur avec l'email ${email}.`)
      process.exit(1)
    }
    await prisma.user.update({
      where: { email },
      data: { mot_de_passe: await bcrypt.hash(password, 10) },
    })
    console.log(`Mot de passe réinitialisé (PostgreSQL) pour ${email} — rôle inchangé (${user.role}).`)
  } finally {
    await prisma.$disconnect()
  }
}

try {
  if (usePostgres) await resetPostgres()
  else await resetJson()
} catch (err) {
  console.error("Échec de la réinitialisation :", err)
  process.exit(1)
}
