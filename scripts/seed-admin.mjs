#!/usr/bin/env node
/**
 * Crée (ou met à jour) un compte administrateur de façon sécurisée à partir
 * des variables d'environnement, sans jamais embarquer d'identifiants connus
 * dans le code source.
 *
 * Variables requises :
 *   ADMIN_EMAIL     - email de l'administrateur
 *   ADMIN_PASSWORD  - mot de passe en clair (sera haché avec bcrypt)
 * Variables optionnelles :
 *   ADMIN_NAME      - nom affiché (défaut: "Administrateur")
 *
 * Cible :
 *   - Si DATABASE_URL / DATABASE_TYPE=postgresql est défini -> table User (Prisma)
 *   - Sinon -> fichier data/users.json (mode fichier)
 *
 * Usage :
 *   ADMIN_EMAIL=admin@exemple.com ADMIN_PASSWORD='MotDePasseFort!' npm run seed:admin
 */
import { promises as fs } from "fs"
import path from "path"
import bcrypt from "bcryptjs"

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME || "Administrateur"

if (!email || !password) {
  console.error(
    "Erreur : ADMIN_EMAIL et ADMIN_PASSWORD sont requis.\n" +
      "Exemple : ADMIN_EMAIL=admin@exemple.com ADMIN_PASSWORD='MotDePasseFort!' npm run seed:admin"
  )
  process.exit(1)
}

if (password.length < 8) {
  console.error("Erreur : ADMIN_PASSWORD doit contenir au moins 8 caractères.")
  process.exit(1)
}

const usePostgres = !!process.env.DATABASE_URL || process.env.DATABASE_TYPE === "postgresql"

async function seedJson() {
  const usersFile = path.join(process.cwd(), "data", "users.json")
  let users = []
  try {
    users = JSON.parse(await fs.readFile(usersFile, "utf-8"))
  } catch {
    users = []
  }

  const hashed = await bcrypt.hash(password, 10)
  const existing = users.find((u) => u.email === email)

  if (existing) {
    existing.nom = name
    existing.role = "admin"
    existing.mot_de_passe = hashed
    console.log(`Admin mis à jour (mode fichier) : ${email}`)
  } else {
    const newId = users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1
    users.push({ id: newId, nom: name, email, role: "admin", mot_de_passe: hashed })
    console.log(`Admin créé (mode fichier) : ${email}`)
  }

  await fs.mkdir(path.dirname(usersFile), { recursive: true })
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2))
}

async function seedPostgres() {
  // Import dynamique : le client Prisma n'est requis qu'en mode base de données.
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()
  try {
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.upsert({
      where: { email },
      update: { nom: name, role: "admin", mot_de_passe: hashed },
      create: { nom: name, email, role: "admin", mot_de_passe: hashed },
    })
    console.log(`Admin créé/mis à jour (PostgreSQL) : ${email}`)
  } finally {
    await prisma.$disconnect()
  }
}

try {
  if (usePostgres) {
    await seedPostgres()
  } else {
    await seedJson()
  }
  console.log("Seed terminé avec succès.")
} catch (err) {
  console.error("Échec du seed admin :", err)
  process.exit(1)
}
