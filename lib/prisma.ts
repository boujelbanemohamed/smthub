import type { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Instanciation paresseuse : le client Prisma n'est créé qu'au premier accès.
// En mode fichier JSON (sans DATABASE_URL), prisma n'est jamais utilisé, donc
// le client n'est jamais instancié — l'application fonctionne même si le client
// Prisma n'a pas été généré.
function createClient(): PrismaClient {
  // require dynamique pour éviter de charger @prisma/client au démarrage.
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client")
  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? [] : ["query", "error", "warn"],
  })
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = globalForPrisma.prisma ?? createClient()
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client
    }
    const value = (client as any)[prop]
    return typeof value === "function" ? value.bind(client) : value
  },
})


