# 🗄️ Guide de Migration Base de Données - SMT HUB

## 📋 **OPTIONS DE BASE DE DONNÉES**

### **1. SQLite (Recommandé pour commencer)**
**Avantages :**
- ✅ Simple à configurer
- ✅ Pas de serveur séparé
- ✅ Parfait pour les petites applications
- ✅ Fichier unique facile à sauvegarder

**Configuration :**
```bash
# Installation
npm install sqlite3 better-sqlite3

# Configuration
DATABASE_TYPE=sqlite
DATABASE_PATH=/var/www/smt-hub/data/smt-hub.db
```

### **2. PostgreSQL (Recommandé pour la production)**
**Avantages :**
- ✅ Robuste et fiable
- ✅ Excellentes performances
- ✅ Support des transactions
- ✅ Évolutif

**Configuration RedHat :**
```bash
# Installation PostgreSQL
sudo dnf install -y postgresql postgresql-server postgresql-contrib

# Initialisation
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Configuration
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://username:password@localhost:5432/smt_hub
```

### **3. MySQL/MariaDB**
**Avantages :**
- ✅ Très répandu
- ✅ Bonnes performances
- ✅ Facile à administrer

**Configuration RedHat :**
```bash
# Installation MariaDB
sudo dnf install -y mariadb mariadb-server

# Initialisation
sudo systemctl enable mariadb
sudo systemctl start mariadb
sudo mysql_secure_installation

# Configuration
DATABASE_TYPE=mysql
DATABASE_URL=mysql://username:password@localhost:3306/smt_hub
```

---

## 🔧 **MIGRATION AVEC PRISMA (RECOMMANDÉ)**

### **1. Installation de Prisma**
```bash
npm install prisma @prisma/client
npx prisma init
```

### **2. Configuration Prisma**
Créer `prisma/schema.prisma` :
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // ou "sqlite" ou "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  nom       String
  email     String   @unique
  role      String   @default("utilisateur")
  mot_de_passe String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userAccess UserAccess[]
}

model Application {
  id              Int      @id @default(autoincrement())
  nom             String
  image_url       String
  app_url         String
  ordre_affichage Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  userAccess UserAccess[]
}

model UserAccess {
  id             Int    @id @default(autoincrement())
  utilisateur_id Int
  application_id Int
  createdAt      DateTime @default(now())

  user        User        @relation(fields: [utilisateur_id], references: [id], onDelete: Cascade)
  application Application @relation(fields: [application_id], references: [id], onDelete: Cascade)

  @@unique([utilisateur_id, application_id])
}

model EmailTemplate {
  id          String   @id @default(cuid())
  name        String
  subject     String
  content     String
  category    String
  enabled     Boolean  @default(true)
  variables   String   // JSON string
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AdminLog {
  id        Int      @id @default(autoincrement())
  level     String   // INFO, WARNING, ERROR, SUCCESS
  action    String
  message   String
  details   String?  // JSON string
  status    String   @default("SUCCESS")
  createdAt DateTime @default(now())
}

model SmtpConfig {
  id         Int      @id @default(autoincrement())
  host       String
  port       Int
  user       String
  password   String
  from_name  String
  from_email String
  secure     Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

### **3. Script de migration des données JSON**
Créer `scripts/migrate-to-database.ts` :
```typescript
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function migrateData() {
  try {
    console.log('🚀 Début de la migration des données...')

    // Lire les données JSON existantes
    const dataPath = path.join(process.cwd(), 'data')
    
    // Migration des utilisateurs
    if (fs.existsSync(path.join(dataPath, 'users.json'))) {
      const users = JSON.parse(fs.readFileSync(path.join(dataPath, 'users.json'), 'utf8'))
      console.log(`📊 Migration de ${users.length} utilisateurs...`)
      
      for (const user of users) {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            nom: user.nom,
            email: user.email,
            role: user.role,
            mot_de_passe: user.mot_de_passe
          },
          create: {
            id: user.id,
            nom: user.nom,
            email: user.email,
            role: user.role,
            mot_de_passe: user.mot_de_passe
          }
        })
      }
    }

    // Migration des applications
    if (fs.existsSync(path.join(dataPath, 'applications.json'))) {
      const applications = JSON.parse(fs.readFileSync(path.join(dataPath, 'applications.json'), 'utf8'))
      console.log(`📊 Migration de ${applications.length} applications...`)
      
      for (const app of applications) {
        await prisma.application.upsert({
          where: { id: app.id },
          update: {
            nom: app.nom,
            image_url: app.image_url,
            app_url: app.app_url,
            ordre_affichage: app.ordre_affichage
          },
          create: {
            id: app.id,
            nom: app.nom,
            image_url: app.image_url,
            app_url: app.app_url,
            ordre_affichage: app.ordre_affichage
          }
        })
      }
    }

    // Migration des accès utilisateurs
    if (fs.existsSync(path.join(dataPath, 'user_access.json'))) {
      const userAccess = JSON.parse(fs.readFileSync(path.join(dataPath, 'user_access.json'), 'utf8'))
      console.log(`📊 Migration de ${userAccess.length} accès utilisateurs...`)
      
      for (const access of userAccess) {
        await prisma.userAccess.upsert({
          where: {
            utilisateur_id_application_id: {
              utilisateur_id: access.utilisateur_id,
              application_id: access.application_id
            }
          },
          update: {},
          create: {
            utilisateur_id: access.utilisateur_id,
            application_id: access.application_id
          }
        })
      }
    }

    // Migration des templates d'emails
    if (fs.existsSync(path.join(dataPath, 'email-templates.json'))) {
      const emailTemplates = JSON.parse(fs.readFileSync(path.join(dataPath, 'email-templates.json'), 'utf8'))
      console.log(`📊 Migration des templates d'emails...`)
      
      for (const template of emailTemplates.templates) {
        await prisma.emailTemplate.upsert({
          where: { id: template.id },
          update: {
            name: template.name,
            subject: template.subject,
            content: template.content,
            category: template.category,
            enabled: template.enabled,
            variables: JSON.stringify(template.variables)
          },
          create: {
            id: template.id,
            name: template.name,
            subject: template.subject,
            content: template.content,
            category: template.category,
            enabled: template.enabled,
            variables: JSON.stringify(template.variables)
          }
        })
      }
    }

    // Migration des logs
    if (fs.existsSync(path.join(dataPath, 'admin-logs.json'))) {
      const logs = JSON.parse(fs.readFileSync(path.join(dataPath, 'admin-logs.json'), 'utf8'))
      console.log(`📊 Migration de ${logs.length} logs...`)
      
      for (const log of logs) {
        await prisma.adminLog.create({
          data: {
            level: log.level,
            action: log.action,
            message: log.message,
            details: log.details ? JSON.stringify(log.details) : null,
            status: log.status,
            createdAt: new Date(log.timestamp)
          }
        })
      }
    }

    console.log('✅ Migration terminée avec succès!')
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateData()
```

### **4. Mise à jour des variables d'environnement**
Ajouter à `.env.production` :
```bash
# Configuration base de données
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://smt_user:smt_password@localhost:5432/smt_hub

# Ou pour SQLite
# DATABASE_TYPE=sqlite
# DATABASE_URL=file:./data/smt-hub.db
```

---

## 🚀 **ÉTAPES DE MIGRATION**

### **Phase 1 : Préparation**
```bash
# 1. Sauvegarder les données existantes
cp -r data data_backup_$(date +%Y%m%d_%H%M%S)

# 2. Installer Prisma
npm install prisma @prisma/client

# 3. Initialiser Prisma
npx prisma init
```

### **Phase 2 : Configuration**
```bash
# 1. Configurer le schéma Prisma
# Éditer prisma/schema.prisma

# 2. Générer le client Prisma
npx prisma generate

# 3. Créer la base de données
npx prisma db push
```

### **Phase 3 : Migration des données**
```bash
# 1. Exécuter le script de migration
npx ts-node scripts/migrate-to-database.ts

# 2. Vérifier les données migrées
npx prisma studio
```

### **Phase 4 : Mise à jour du code**
```bash
# 1. Remplacer les imports JSON par Prisma
# 2. Mettre à jour les APIs
# 3. Tester l'application
```

---

## 📊 **COMPARAISON DES SOLUTIONS**

| Critère | JSON Files | SQLite | PostgreSQL | MySQL |
|---------|------------|--------|------------|-------|
| **Simplicité** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Performance** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scalabilité** | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Sauvegarde** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Concurrence** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Maintenance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎯 **RECOMMANDATIONS**

### **Pour le développement :**
- ✅ **Garder JSON** pour la simplicité

### **Pour la production (petite équipe) :**
- ✅ **SQLite** pour commencer
- ✅ **PostgreSQL** pour évoluer

### **Pour la production (grande équipe) :**
- ✅ **PostgreSQL** directement

---

## 🔄 **PLAN DE MIGRATION GRADUEL**

### **Étape 1 : Améliorer le système JSON**
- ✅ Implémenter le `DatabaseManager`
- ✅ Ajouter les sauvegardes automatiques
- ✅ Améliorer la validation des données

### **Étape 2 : Préparer la migration**
- ✅ Installer Prisma
- ✅ Créer le schéma de base de données
- ✅ Préparer le script de migration

### **Étape 3 : Migration en production**
- ✅ Tester en environnement de développement
- ✅ Planifier la migration en production
- ✅ Exécuter la migration avec rollback possible

### **Étape 4 : Optimisation**
- ✅ Ajouter les index de base de données
- ✅ Optimiser les requêtes
- ✅ Configurer le monitoring

---

## ✅ **CONCLUSION**

**Pour le déploiement immédiat :**
- ✅ **Garder le système JSON** avec le `DatabaseManager` amélioré
- ✅ **Planifier la migration** vers PostgreSQL pour l'avenir

**Avantages de cette approche :**
- 🚀 **Déploiement rapide** sans configuration de base de données
- 🔄 **Migration future** possible sans interruption
- 💾 **Sauvegardes robustes** avec le nouveau système
- 📊 **Monitoring** des données avec le `DatabaseManager`

**L'application est prête pour la production avec le système JSON amélioré ! 🎉** 