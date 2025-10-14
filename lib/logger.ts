import { promises as fs } from "fs"
import path from "path"

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
    
    // Garder seulement les 1000 derniers logs pour éviter l'explosion du fichier
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000)
    }

    await writeLogs(logs)
    
    // Log dans la console pour le développement
    const logMessage = `[${logEntry.timestamp}] ${level}: ${action} - ${details}`
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
    const logs = await readLogs()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const filteredLogs = logs.filter(log => 
      new Date(log.timestamp) > cutoffDate
    )
    
    await writeLogs(filteredLogs)
    console.log(`Nettoyage des logs: ${logs.length - filteredLogs.length} entrées supprimées`)
  } catch (error) {
    console.error("Erreur lors du nettoyage des logs:", error)
  }
} 