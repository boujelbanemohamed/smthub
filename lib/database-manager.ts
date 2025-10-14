import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)

interface DatabaseConfig {
  dataDir: string
  backupDir: string
  maxBackups: number
  autoBackup: boolean
}

class DatabaseManager {
  private config: DatabaseConfig
  private dataPath: string
  private backupPath: string
  private lockFile: string

  constructor(config: DatabaseConfig) {
    this.config = config
    this.dataPath = path.resolve(config.dataDir)
    this.backupPath = path.resolve(config.backupDir)
    this.lockFile = path.join(this.dataPath, '.lock')
    
    this.ensureDirectories()
  }

  private async ensureDirectories() {
    try {
      await mkdir(this.dataPath, { recursive: true })
      await mkdir(this.backupPath, { recursive: true })
    } catch (error) {
      console.error('Erreur lors de la création des répertoires:', error)
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = await readFile(this.lockFile, 'utf8')
        const lockTime = parseInt(lockData)
        const now = Date.now()
        
        // Si le lock a plus de 30 secondes, on le considère comme expiré
        if (now - lockTime > 30000) {
          await this.releaseLock()
        } else {
          return false
        }
      }
      
      await writeFile(this.lockFile, Date.now().toString())
      return true
    } catch (error) {
      console.error('Erreur lors de l\'acquisition du lock:', error)
      return false
    }
  }

  private async releaseLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile)
      }
    } catch (error) {
      console.error('Erreur lors de la libération du lock:', error)
    }
  }

  async readData<T>(filename: string): Promise<T[]> {
    const filePath = path.join(this.dataPath, filename)
    
    try {
      if (!fs.existsSync(filePath)) {
        return []
      }
      
      const data = await readFile(filePath, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error(`Erreur lors de la lecture de ${filename}:`, error)
      return []
    }
  }

  async writeData<T>(filename: string, data: T[]): Promise<boolean> {
    const filePath = path.join(this.dataPath, filename)
    
    try {
      // Sauvegarde automatique avant écriture
      if (this.config.autoBackup) {
        await this.createBackup(filename)
      }
      
      // Écriture atomique avec fichier temporaire
      const tempFile = `${filePath}.tmp`
      await writeFile(tempFile, JSON.stringify(data, null, 2))
      
      // Renommer le fichier temporaire
      fs.renameSync(tempFile, filePath)
      
      return true
    } catch (error) {
      console.error(`Erreur lors de l'écriture de ${filename}:`, error)
      return false
    }
  }

  async createBackup(filename: string): Promise<string | null> {
    try {
      const sourceFile = path.join(this.dataPath, filename)
      if (!fs.existsSync(sourceFile)) {
        return null
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFile = path.join(this.backupPath, `${filename}.${timestamp}.backup`)
      
      fs.copyFileSync(sourceFile, backupFile)
      
      // Nettoyer les anciennes sauvegardes
      await this.cleanOldBackups(filename)
      
      return backupFile
    } catch (error) {
      console.error(`Erreur lors de la création de la sauvegarde de ${filename}:`, error)
      return null
    }
  }

  private async cleanOldBackups(filename: string): Promise<void> {
    try {
      const files = fs.readdirSync(this.backupPath)
      const backups = files
        .filter(file => file.startsWith(filename) && file.endsWith('.backup'))
        .map(file => ({
          name: file,
          path: path.join(this.backupPath, file),
          time: fs.statSync(path.join(this.backupPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      // Supprimer les sauvegardes en excès
      if (backups.length > this.config.maxBackups) {
        const toDelete = backups.slice(this.config.maxBackups)
        for (const backup of toDelete) {
          fs.unlinkSync(backup.path)
        }
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage des sauvegardes:', error)
    }
  }

  async restoreBackup(filename: string, backupFile: string): Promise<boolean> {
    try {
      const sourceFile = path.join(this.backupPath, backupFile)
      const targetFile = path.join(this.dataPath, filename)
      
      if (!fs.existsSync(sourceFile)) {
        return false
      }
      
      fs.copyFileSync(sourceFile, targetFile)
      return true
    } catch (error) {
      console.error(`Erreur lors de la restauration de ${filename}:`, error)
      return false
    }
  }

  async getBackups(filename: string): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.backupPath)
      return files
        .filter(file => file.startsWith(filename) && file.endsWith('.backup'))
        .sort((a, b) => {
          const timeA = fs.statSync(path.join(this.backupPath, a)).mtime.getTime()
          const timeB = fs.statSync(path.join(this.backupPath, b)).mtime.getTime()
          return timeB - timeA
        })
    } catch (error) {
      console.error('Erreur lors de la récupération des sauvegardes:', error)
      return []
    }
  }

  async validateData<T>(data: T[]): Promise<boolean> {
    try {
      // Validation basique - vérifier que c'est un tableau
      if (!Array.isArray(data)) {
        return false
      }
      
      // Validation spécifique selon le type de données
      if (data.length > 0) {
        const firstItem = data[0] as any
        
        // Validation pour les utilisateurs
        if (firstItem.email && firstItem.nom) {
          return data.every((item: any) => 
            item.id && 
            item.email && 
            item.nom && 
            typeof item.id === 'number' &&
            typeof item.email === 'string' &&
            typeof item.nom === 'string'
          )
        }
        
        // Validation pour les applications
        if (firstItem.nom && firstItem.app_url) {
          return data.every((item: any) => 
            item.id && 
            item.nom && 
            item.app_url && 
            typeof item.id === 'number' &&
            typeof item.nom === 'string' &&
            typeof item.app_url === 'string'
          )
        }
        
        // Validation pour les accès utilisateurs
        if (firstItem.utilisateur_id && firstItem.application_id) {
          return data.every((item: any) => 
            item.utilisateur_id && 
            item.application_id && 
            typeof item.utilisateur_id === 'number' &&
            typeof item.application_id === 'number'
          )
        }
      }
      
      return true
    } catch (error) {
      console.error('Erreur lors de la validation des données:', error)
      return false
    }
  }

  async compactData(filename: string): Promise<boolean> {
    try {
      const data = await this.readData(filename)
      if (data.length === 0) {
        return true
      }
      
      // Supprimer les doublons et trier
      const uniqueData = data.filter((item: any, index: number, self: any[]) => 
        index === self.findIndex((t: any) => 
          item.id ? t.id === item.id : 
          item.utilisateur_id ? 
            t.utilisateur_id === item.utilisateur_id && t.application_id === item.application_id :
            JSON.stringify(t) === JSON.stringify(item)
        )
      )
      
      return await this.writeData(filename, uniqueData)
    } catch (error) {
      console.error(`Erreur lors de la compaction de ${filename}:`, error)
      return false
    }
  }

  async getStats(): Promise<{
    totalFiles: number
    totalSize: number
    backups: number
    lastBackup: string | null
  }> {
    try {
      const files = fs.readdirSync(this.dataPath)
      const dataFiles = files.filter(file => file.endsWith('.json'))
      
      let totalSize = 0
      for (const file of dataFiles) {
        const filePath = path.join(this.dataPath, file)
        const stats = fs.statSync(filePath)
        totalSize += stats.size
      }
      
      const backupFiles = fs.readdirSync(this.backupPath)
      const backups = backupFiles.filter(file => file.endsWith('.backup'))
      
      let lastBackup = null
      if (backups.length > 0) {
        const backupStats = fs.statSync(path.join(this.backupPath, backups[0]))
        lastBackup = backupStats.mtime.toISOString()
      }
      
      return {
        totalFiles: dataFiles.length,
        totalSize,
        backups: backups.length,
        lastBackup
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        backups: 0,
        lastBackup: null
      }
    }
  }
}

// Configuration par défaut
const defaultConfig: DatabaseConfig = {
  dataDir: process.env.DATA_DIR || './data',
  backupDir: process.env.BACKUP_DIR || './backups',
  maxBackups: parseInt(process.env.MAX_BACKUPS || '10'),
  autoBackup: process.env.AUTO_BACKUP !== 'false'
}

// Instance singleton
export const databaseManager = new DatabaseManager(defaultConfig)

export default DatabaseManager 