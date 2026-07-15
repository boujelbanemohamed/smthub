import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireSuperAdmin, authErrorResponse } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toCsv } from "@/lib/csv"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

// GET → CSV des utilisateurs (SANS mot de passe).
export async function GET() {
  try {
    await requireSuperAdmin()
    const usePostgres = process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL

    let users: any[] = []
    if (usePostgres) {
      users = await prisma.user.findMany({ orderBy: { id: "asc" } })
    } else {
      try {
        users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
      } catch {
        users = []
      }
    }

    const rows = users.map((u) => ({ nom: u.nom, email: u.email, role: u.role }))
    const csv = toCsv(["nom", "email", "role"], rows)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="utilisateurs.csv"`,
      },
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
