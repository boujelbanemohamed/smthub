/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

async function readJson(file) {
  try {
    const p = path.join(process.cwd(), "data", file)
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch (e) {
    console.error("Erreur lecture JSON", file, e)
    return null
  }
}

async function run() {
  console.log("🚀 Migration JSON -> PostgreSQL")
  try {
    const users = await readJson("users.json")
    if (Array.isArray(users)) {
      console.log(`📊 Utilisateurs: ${users.length}`)
      for (const u of users) {
        await prisma.user.upsert({
          where: { email: u.email },
          update: {
            nom: u.nom,
            role: u.role || "utilisateur",
            mot_de_passe: u.mot_de_passe || "",
          },
          create: {
            id: typeof u.id === "number" ? u.id : undefined,
            nom: u.nom,
            email: u.email,
            role: u.role || "utilisateur",
            mot_de_passe: u.mot_de_passe || "",
          },
        })
      }
    }

    const apps = await readJson("applications.json")
    if (Array.isArray(apps)) {
      console.log(`📊 Applications: ${apps.length}`)
      for (const a of apps) {
        await prisma.application.upsert({
          where: { id: a.id },
          update: {
            nom: a.nom,
            image_url: a.image_url,
            app_url: a.app_url,
            ordre_affichage: a.ordre_affichage || 0,
          },
          create: {
            id: a.id,
            nom: a.nom,
            image_url: a.image_url,
            app_url: a.app_url,
            ordre_affichage: a.ordre_affichage || 0,
          },
        })
      }
    }

    const access = await readJson("user_access.json")
    if (Array.isArray(access)) {
      console.log(`📊 Accès utilisateurs: ${access.length}`)
      for (const r of access) {
        await prisma.userAccess.upsert({
          where: {
            utilisateur_id_application_id: {
              utilisateur_id: r.utilisateur_id,
              application_id: r.application_id,
            },
          },
          update: {},
          create: {
            utilisateur_id: r.utilisateur_id,
            application_id: r.application_id,
          },
        })
      }
    }

    const templates = await readJson("email-templates.json")
    if (templates && Array.isArray(templates.templates)) {
      console.log(`📊 Templates d'emails: ${templates.templates.length}`)
      for (const t of templates.templates) {
        await prisma.emailTemplate.upsert({
          where: { id: t.id },
          update: {
            name: t.name,
            subject: t.subject,
            content: t.content,
            category: t.category,
            enabled: !!t.enabled,
            variables: JSON.stringify(t.variables ?? {}),
          },
          create: {
            id: t.id,
            name: t.name,
            subject: t.subject,
            content: t.content,
            category: t.category,
            enabled: !!t.enabled,
            variables: JSON.stringify(t.variables ?? {}),
          },
        })
      }
    }

    const logs = await readJson("admin-logs.json")
    if (Array.isArray(logs)) {
      console.log(`📊 Logs admin: ${logs.length}`)
      for (const l of logs) {
        await prisma.adminLog.create({
          data: {
            level: l.level || "INFO",
            action: l.action || "",
            message: l.message || "",
            details: l.details ? JSON.stringify(l.details) : null,
            status: l.status || "SUCCESS",
            createdAt: l.timestamp ? new Date(l.timestamp) : undefined,
          },
        })
      }
    }

    console.log("✅ Migration terminée")
  } catch (e) {
    console.error("❌ Erreur de migration", e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

run()


