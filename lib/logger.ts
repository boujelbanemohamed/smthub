import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"

export interface LogEntry {
  id: string
  timestamp: string
  level: "INFO" | "WARNING" | "ERROR" | "SUCCESS"
  action: string
  userId?: number
  userName?: string
  details: string
  ip?: string
  userAgent?: string
  duration?: number
  status: "SUCCESS" | "FAILED" | "PENDING"
  errorMessage?: string
  metadata?: Record<string, any>
}

const LOGS_FILE = path.join(process.cwd(), "data", "admin-logs.json")

function usePostgres(): boolean {
  return !!process.env.DATABASE_URL || process.env.DATABASE_TYPE === "postgresql"
}

// Fonction pour générer un ID unique
function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Fonction pour lire les logs existants
async function readLogs(): Promise<LogEntry[]> {
  try {
    const data = await fs.readFile(LOGS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Fonction pour écrire les logs
async function writeLogs(logs: LogEntry[]): Promise<void> {
  const dataDir = path.dirname(LOGS_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2))
}

// Fonction principale pour logger une action
export async function logAction(
  action: string,
  details: string,
  level: LogEntry["level"] = "INFO",
  userId?: number,
  userName?: string,
  ip?: string,
  userAgent?: string,
  duration?: number,
  status: LogEntry["status"] = "SUCCESS",
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    if (usePostgres()) {
      await prisma.adminLog.create({
        data: {
          level,
          action,
          message: details,
          details: metadata ? JSON.stringify({ userId, userName, ip, userAgent, duration, errorMessage, metadata }) : JSON.stringify({ userId, userName, ip, userAgent, duration, errorMessage }),
          status
        }
      })
    } else {
      const logs = await readLogs()
      const logEntry: LogEntry = {
        id: generateLogId(),
        timestamp: new Date().toISOString(),
        level,
        action,
        userId,
        userName,
        details,
        ip,
        userAgent,
        duration,
        status,
        errorMessage,
        metadata
      }
      logs.push(logEntry)
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000)
      }
      await writeLogs(logs)
    }
    
    // Log dans la console pour le développement
    const logMessage = `[${new Date().toISOString()}] ${level}: ${action} - ${details}`
    if (level === "ERROR") {
      console.error(logMessage)
    } else if (level === "WARNING") {
      console.warn(logMessage)
    } else {
      console.log(logMessage)
    }
  } catch (error) {
    console.error("Erreur lors de l'écriture du log:", error)
  }
}

// Fonctions utilitaires pour différents types d'actions
export async function logUserAction(
  action: string,
  userId: number,
  userName: string,
  details: string,
  status: LogEntry["status"] = "SUCCESS",
  errorMessage?: string
): Promise<void> {
  await logAction(
    action,
    details,
    "INFO",
    userId,
    userName,
    undefined,
    undefined,
    undefined,
    status,
    errorMessage
  )
}

export async function logApplicationAction(
  action: string,
  appId: number,
  appName: string,
  userId: number,
  userName: string,
  details: string,
  status: LogEntry["status"] = "SUCCESS",
  errorMessage?: string
): Promise<void> {
  await logAction(
    action,
    details,
    "INFO",
    userId,
    userName,
    undefined,
    undefined,
    undefined,
    status,
    errorMessage,
    { appId, appName }
  )
}

export async function logAccessAction(
  action: string,
  userId: number,
  userName: string,
  appId: number,
  appName: string,
  details: string,
  status: LogEntry["status"] = "SUCCESS",
  errorMessage?: string
): Promise<void> {
  await logAction(
    action,
    details,
    "INFO",
    userId,
    userName,
    undefined,
    undefined,
    undefined,
    status,
    errorMessage,
    { appId, appName }
  )
}

export async function logSmtpAction(
  action: string,
  userId: number,
  userName: string,
  details: string,
  status: LogEntry["status"] = "SUCCESS",
  errorMessage?: string
): Promise<void> {
  await logAction(
    action,
    details,
    "INFO",
    userId,
    userName,
    undefined,
    undefined,
    undefined,
    status,
    errorMessage
  )
}

export async function logTemplateAction(
  action: string,
  templateId: string,
  userId: number,
  userName: string,
  details: string,
  status: LogEntry["status"] = "SUCCESS",
  errorMessage?: string
): Promise<void> {
  await logAction(
    action,
    details,
    "INFO",
    userId,
    userName,
    undefined,
    undefined,
    undefined,
    status,
    errorMessage,
    { templateId }
  )
}

export async function logError(
  action: string,
  details: string,
  errorMessage: string,
  userId?: number,
  userName?: string
): Promise<void> {
  await logAction(
    action,
    details,
    "ERROR",
    userId,
    userName,
    undefined,
    undefined,
    undefined,
    "FAILED",
    errorMessage
  )
}

// Fonction pour récupérer les logs avec filtres
export async function getLogs(
  filters?: {
    level?: LogEntry["level"]
    action?: string
    userId?: number
    status?: LogEntry["status"]
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<LogEntry[]> {
  try {
    if (usePostgres()) {
      const where: any = {}
      if (filters?.level) where.level = filters.level
      if (filters?.status) where.status = filters.status
      if (filters?.action) where.action = { contains: filters.action, mode: "insensitive" }
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
      }
      const rows = await prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters?.limit || 100
      })
      // Adapter au format LogEntry pour compatibilité UI
      return rows.map(r => {
        let parsed: any = {}
        try {
          parsed = r.details ? JSON.parse(r.details) : {}
        } catch {
          parsed = {}
        }
        const entry: LogEntry = {
          id: String(r.id),
          timestamp: r.createdAt.toISOString(),
          level: r.level as any,
          action: r.action,
          details: r.message,
          status: r.status as any,
        }
        if (parsed.userId !== undefined) entry.userId = parsed.userId
        if (parsed.userName !== undefined) entry.userName = parsed.userName
        if (parsed.errorMessage) entry.errorMessage = parsed.errorMessage
        if (parsed.metadata) entry.metadata = parsed.metadata
        return entry
      })
    }

    const logs = await readLogs()
    let filteredLogs = [...logs]

    if (filters) {
      if (filters.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filters.level)
      }
      
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => 
          log.action.toLowerCase().includes(filters.action!.toLowerCase())
        )
      }
      
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId)
      }
      
      if (filters.status) {
        filteredLogs = filteredLogs.filter(log => log.status === filters.status)
      }
      
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!)
      }
      
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!)
      }
    }

    // Trier par timestamp décroissant (plus récent en premier)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Appliquer la limite
    if (filters?.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit)
    }

    return filteredLogs
  } catch (error) {
    console.error("Erreur lors de la lecture des logs:", error)
    return []
  }
}

// Fonction pour nettoyer les anciens logs
export async function cleanOldLogs(daysToKeep: number = 30): Promise<void> {
  try {
    if (usePostgres()) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      await prisma.adminLog.deleteMany({
        where: { createdAt: { lte: cutoffDate } }
      })
      console.log(`Nettoyage des logs (DB): > ${daysToKeep} jours supprimés`)
    } else {
      const logs = await readLogs()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const filteredLogs = logs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      )
      await writeLogs(filteredLogs)
      console.log(`Nettoyage des logs: ${logs.length - filteredLogs.length} entrées supprimées`)
    }
  } catch (error) {
    console.error("Erreur lors du nettoyage des logs:", error)
  }
} 