# 🚀 Guide de Déploiement Production - SMT HUB sur RedHat

## 📋 **PRÉREQUIS SYSTÈME**

### **Système d'exploitation**
- ✅ **RedHat Enterprise Linux 8/9** ou **CentOS 8/9**
- ✅ **Mémoire minimale** : 4GB RAM
- ✅ **Espace disque** : 20GB minimum
- ✅ **CPU** : 2 cœurs minimum

### **Services requis**
- ✅ **Node.js 18+** (LTS recommandé)
- ✅ **Nginx** (reverse proxy)
- ✅ **PM2** (process manager)
- ✅ **Firewall** (firewalld)
- ✅ **SELinux** (configuré)

---

## 🔧 **ÉTAPES DE DÉPLOIEMENT**

### **1. PRÉPARATION DU SERVEUR**

#### **1.1 Mise à jour du système**
```bash
# Mise à jour du système
sudo dnf update -y

# Installation des outils de base
sudo dnf install -y wget curl git unzip
```

#### **1.2 Installation de Node.js**
```bash
# Ajout du repository NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

# Installation de Node.js
sudo dnf install -y nodejs

# Vérification
node --version
npm --version
```

#### **1.3 Installation de Nginx**
```bash
# Installation de Nginx
sudo dnf install -y nginx

# Démarrage et activation
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### **1.4 Installation de PM2**
```bash
# Installation globale de PM2
sudo npm install -g pm2

# Configuration PM2 pour démarrer au boot
pm2 startup
```

### **2. CONFIGURATION DE L'APPLICATION**

#### **2.1 Variables d'environnement**
Créer le fichier `.env.production` :
```bash
# Créer le fichier d'environnement
cat > .env.production << EOF
# Configuration de base
NODE_ENV=production
PORT=4000

# Configuration de base de données (si applicable)
# DATABASE_URL=your_database_url

# Configuration SMTP (optionnel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@smt.com

# Configuration de sécurité
JWT_SECRET=your_super_secret_jwt_key_here
COOKIE_SECRET=your_super_secret_cookie_key_here

# Configuration des logs
LOG_LEVEL=INFO
LOG_RETENTION_DAYS=30

# Configuration du cache
CACHE_TTL=300
CACHE_MAX_SIZE=1000
EOF
```

#### **2.2 Configuration Next.js pour production**
Modifier `next.config.mjs` :
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configuration production
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
  // Configuration des headers de sécurité
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

### **3. DÉPLOIEMENT DE L'APPLICATION**

#### **3.1 Clonage et installation**
```bash
# Créer le répertoire d'application
sudo mkdir -p /var/www/smt-hub
sudo chown $USER:$USER /var/www/smt-hub

# Cloner l'application (si dans un repo Git)
cd /var/www/smt-hub
git clone https://github.com/your-repo/smt-hub.git .

# Ou copier les fichiers manuellement
# cp -r /path/to/your/app/* /var/www/smt-hub/

# Installation des dépendances
npm ci --only=production

# Build de l'application
npm run build
```

#### **3.2 Configuration PM2**
Créer `ecosystem.config.js` :
```javascript
module.exports = {
  apps: [
    {
      name: 'smt-hub',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/smt-hub',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_file: '.env.production',
      error_file: '/var/log/smt-hub/error.log',
      out_file: '/var/log/smt-hub/out.log',
      log_file: '/var/log/smt-hub/combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}
```

#### **3.3 Création des logs**
```bash
# Créer le répertoire de logs
sudo mkdir -p /var/log/smt-hub
sudo chown $USER:$USER /var/log/smt-hub
```

### **4. CONFIGURATION NGINX**

#### **4.1 Configuration du site**
Créer `/etc/nginx/sites-available/smt-hub` :
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # Configuration SSL (à adapter selon votre certificat)
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Headers de sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Configuration des logs
    access_log /var/log/nginx/smt-hub.access.log;
    error_log /var/log/nginx/smt-hub.error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Proxy vers l'application Next.js
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Cache statique
    location /_next/static/ {
        alias /var/www/smt-hub/.next/static/;
        expires 365d;
        access_log off;
    }

    # Cache public
    location /public/ {
        alias /var/www/smt-hub/public/;
        expires 30d;
        access_log off;
    }
}
```

#### **4.2 Activation du site**
```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/smt-hub /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
```

### **5. CONFIGURATION SÉCURITÉ**

#### **5.1 Configuration Firewall**
```bash
# Configuration du firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=4000/tcp
sudo firewall-cmd --reload
```

#### **5.2 Configuration SELinux**
```bash
# Configuration SELinux pour Nginx
sudo setsebool -P httpd_can_network_connect 1

# Configuration pour l'application
sudo semanage port -a -t http_port_t -p tcp 4000
```

#### **5.3 Configuration des permissions**
```bash
# Permissions pour l'application
sudo chown -R nginx:nginx /var/www/smt-hub
sudo chmod -R 755 /var/www/smt-hub

# Permissions pour les logs
sudo chown -R nginx:nginx /var/log/smt-hub
```

### **6. DÉMARRAGE DE L'APPLICATION**

#### **6.1 Démarrage avec PM2**
```bash
# Démarrer l'application
cd /var/www/smt-hub
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

# Vérifier le statut
pm2 status
pm2 logs smt-hub
```

#### **6.2 Script de déploiement**
Créer `/var/www/smt-hub/deploy.sh` :
```bash
#!/bin/bash

# Script de déploiement
set -e

echo "🚀 Déploiement SMT HUB..."

# Arrêter l'application
pm2 stop smt-hub

# Pull des dernières modifications (si Git)
# git pull origin main

# Installation des dépendances
npm ci --only=production

# Build de l'application
npm run build

# Redémarrer l'application
pm2 start smt-hub

echo "✅ Déploiement terminé!"
```

```bash
# Rendre le script exécutable
chmod +x /var/www/smt-hub/deploy.sh
```

### **7. MONITORING ET MAINTENANCE**

#### **7.1 Configuration des logs**
```bash
# Rotation des logs
sudo tee /etc/logrotate.d/smt-hub << EOF
/var/log/smt-hub/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

#### **7.2 Monitoring PM2**
```bash
# Installation de PM2 monitoring
pm2 install pm2-server-monit

# Configuration du monitoring
pm2 set pm2-server-monit:email your-email@domain.com
```

#### **7.3 Script de maintenance**
Créer `/var/www/smt-hub/maintenance.sh` :
```bash
#!/bin/bash

# Script de maintenance
echo "🔧 Maintenance SMT HUB..."

# Sauvegarde des données
cp -r /var/www/smt-hub/data /var/backup/smt-hub/$(date +%Y%m%d_%H%M%S)

# Nettoyage des logs anciens
find /var/log/smt-hub -name "*.log" -mtime +30 -delete

# Redémarrage de l'application
pm2 restart smt-hub

echo "✅ Maintenance terminée!"
```

---

## 🔍 **VÉRIFICATIONS POST-DÉPLOIEMENT**

### **Tests de connectivité**
```bash
# Test local
curl -I http://localhost:4000

# Test via Nginx
curl -I https://your-domain.com

# Test des logs
tail -f /var/log/smt-hub/out.log
```

### **Tests de performance**
```bash
# Test de charge simple
ab -n 1000 -c 10 https://your-domain.com/

# Monitoring des ressources
htop
pm2 monit
```

### **Tests de sécurité**
```bash
# Vérification des ports ouverts
sudo netstat -tlnp

# Vérification SSL
openssl s_client -connect your-domain.com:443
```

---

## 📊 **MÉTRIQUES ET MONITORING**

### **Configuration de monitoring**
```bash
# Installation de monitoring système
sudo dnf install -y htop iotop nethogs

# Configuration de monitoring PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### **Alertes système**
Créer `/etc/cron.d/smt-hub-monitoring` :
```bash
# Monitoring quotidien
0 2 * * * root /var/www/smt-hub/maintenance.sh

# Vérification des logs
0 */6 * * * root tail -n 100 /var/log/smt-hub/error.log | grep -i error && echo "Erreurs détectées dans les logs SMT HUB" | mail -s "Alerte SMT HUB" admin@domain.com
```

---

## 🚨 **TROUBLESHOOTING**

### **Problèmes courants**

#### **Application ne démarre pas**
```bash
# Vérifier les logs
pm2 logs smt-hub

# Vérifier les permissions
ls -la /var/www/smt-hub/

# Vérifier les variables d'environnement
pm2 env smt-hub
```

#### **Nginx ne fonctionne pas**
```bash
# Vérifier la configuration
sudo nginx -t

# Vérifier les logs
sudo tail -f /var/log/nginx/error.log

# Vérifier le statut
sudo systemctl status nginx
```

#### **Problèmes de SSL**
```bash
# Vérifier le certificat
openssl x509 -in /etc/ssl/certs/your-domain.crt -text -noout

# Tester la connexion
curl -I https://your-domain.com
```

---

## 📋 **CHECKLIST DE DÉPLOIEMENT**

### **✅ Prérequis**
- [ ] Serveur RedHat configuré
- [ ] Node.js 18+ installé
- [ ] Nginx installé et configuré
- [ ] PM2 installé
- [ ] Firewall configuré
- [ ] Certificat SSL obtenu

### **✅ Application**
- [ ] Code déployé sur le serveur
- [ ] Variables d'environnement configurées
- [ ] Build de production effectué
- [ ] PM2 configuré et démarré
- [ ] Logs configurés

### **✅ Infrastructure**
- [ ] Nginx configuré et actif
- [ ] SSL configuré
- [ ] Firewall ouvert
- [ ] SELinux configuré
- [ ] Monitoring configuré

### **✅ Tests**
- [ ] Application accessible
- [ ] SSL fonctionnel
- [ ] Logs générés
- [ ] Performance acceptable
- [ ] Sécurité vérifiée

---

## 🎯 **CONCLUSION**

### **✅ PRÊT POUR LA PRODUCTION**

L'application SMT HUB est maintenant configurée pour la production sur RedHat avec :

- 🔧 **Infrastructure robuste** : Nginx + PM2 + SSL
- 🔐 **Sécurité renforcée** : Firewall + SELinux + Headers
- 📊 **Monitoring complet** : Logs + Alertes + Métriques
- ⚡ **Performance optimisée** : Cache + Compression + Load balancing
- 🛠️ **Maintenance automatisée** : Scripts de déploiement et maintenance

**L'application est prête pour la production ! 🚀** 