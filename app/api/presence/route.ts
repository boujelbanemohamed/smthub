import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getCurrentUser, requireAdmin, authErrorResponse, isBankAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { touchPresence, getPresenceMap, isConnected, getLastLoginMap } from "@/lib/presence-store"

const USERS_FILE = path.join(process.cwd(), "data", "users.json")

function usePostgres(): boolean {
  return process.env.DATABASE_TYPE === "postgresql" || !!process.env.DATABASE_URL
}

async function readAllUsers(): Promise<{ id: number; nom: string; email: string; role: string; avatar?: string | null }[]> {
  if (usePostgres()) {
    return prisma.user.findMany({ select: { id: true, nom: true, email: true, role: true, avatar: true } }) as any
  }
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf-8"))
  } catch {
    return []
  }
}

// POST → « heartbeat » : enregistre que l'utilisateur courant est actif.
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    await touchPresence(user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// GET → (admin) liste des utilisateurs connectés et non connectés.
export async function GET() {
  try {
    const me = await requireAdmin()
    let [users, presence, lastLogin] = await Promise.all([readAllUsers(), getPresenceMap(), getLastLoginMap()])
    // Cloisonnement : un admin de banque ne voit que les utilisateurs de sa banque.
    if (isBankAdmin(me)) {
      users = users.filter((u: any) => u.banque_id === me.banque_id)
    }
    const now = Date.now()

    const connected: any[] = []
    const disconnected: any[] = []
    for (const u of users) {
      const lastSeen = presence[String(u.id)]
      const entry = {
        id: u.id, nom: u.nom, email: u.email, role: u.role, avatar: u.avatar ?? null,
        last_seen: lastSeen || null,
        last_login: lastLogin[String(u.id)] || null,
      }
      if (isConnected(lastSeen, now)) connected.push(entry)
      else disconnected.push(entry)
    }
    // Connectés d'abord par activité récente ; non connectés par dernière connexion
    connected.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
    disconnected.sort((a, b) => new Date(b.last_login || 0).getTime() - new Date(a.last_login || 0).getTime())

    return NextResponse.json({ connected, disconnected })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
