import { type NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"

const ACCESS_HISTORY_FILE = path.join(process.cwd(), "data", "access-history.json")

export interface AccessHistoryEntry {
  id: string
  utilisateur_id: number
  application_id: number
  action: "granted" | "revoked" | "modified"
  old_level?: string
  new_level?: string
  performed_by: number // ID de l'admin qui a effectué l'action
  performed_at: string
  ip_address?: string
  user_agent?: string
}

export function usePostgres(): boolean {
  return !!process.env.DATABASE_URL || process.env.DATABASE_TYPE === "postgresql"
}

export async function readAccessHistory(): Promise<AccessHistoryEntry[]> {
  try {
    if (usePostgres()) {
      const rows = await prisma.accessHistory.findMany({
        orderBy: { performed_at: "desc" },
        take: 1000
      })
      return rows.map((r: any) => ({
        id: r.id,
        utilisateur_id: r.utilisateur_id,
        application_id: r.application_id,
        action: r.action as any,
        old_level: r.old_level || undefined,
        new_level: r.new_level || undefined,
        performed_by: r.performed_by,
        performed_at: r.performed_at.toISOString(),
        ip_address: r.ip_address || undefined,
        user_agent: r.user_agent || undefined
      }))
    }
    const data = await fs.readFile(ACCESS_HISTORY_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function writeAccessHistory(history: AccessHistoryEntry[]) {
  if (usePostgres()) {
    // No-op: en mode DB, l'écriture se fait entrée par entrée
    return
  }
  const dataDir = path.dirname(ACCESS_HISTORY_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(ACCESS_HISTORY_FILE, JSON.stringify(history, null, 2))
}

export async function logAccessChange(
  userId: number,
  appId: number,
  action: "granted" | "revoked" | "modified",
  performedBy: number,
  oldLevel?: string,
  newLevel?: string,
  request?: NextRequest
): Promise<void> {
  try {
    const ip = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown"
    const ua = request?.headers.get("user-agent") || "unknown"

    if (usePostgres()) {
      await prisma.accessHistory.create({
        data: {
          utilisateur_id: userId,
          application_id: appId,
          action,
          old_level: oldLevel || null,
          new_level: newLevel || null,
          performed_by: performedBy,
          ip_address: ip,
          user_agent: ua
        }
      })
      return
    }

    const history = await readAccessHistory()
    const entry: AccessHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      utilisateur_id: userId,
      application_id: appId,
      action,
      old_level: oldLevel,
      new_level: newLevel,
      performed_by: performedBy,
      performed_at: new Date().toISOString(),
      ip_address: ip,
      user_agent: ua
    }
    history.unshift(entry)
    if (history.length > 1000) {
      history.splice(1000)
    }
    await writeAccessHistory(history)
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'historique d'accès:", error)
  }
}
