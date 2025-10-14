#!/bin/bash

# Script de déploiement SMT HUB
set -e

# Configuration
APP_NAME="smt-hub"
APP_DIR="/var/www/smt-hub"
BACKUP_DIR="/var/backup/smt-hub"
LOG_DIR="/var/log/smt-hub"
# Déploiement depuis Git
BRANCH="${BRANCH:-main}"
REPO_URL_DEFAULT="https://github.com/boujelbanemohamed/smthub.git"
REPO_URL="${REPO_URL:-$REPO_URL_DEFAULT}"
# Optionnel: injecter un token GitHub via env GITHUB_TOKEN (ne pas committer le token)
# export GITHUB_TOKEN=ghp_xxx

# Domaine (optionnel). Si non défini, Nginx écoutera sur _ par défaut
DOMAIN="${DOMAIN:-_}"

# PostgreSQL (optionnel mais activé par défaut)
POSTGRES_ENABLE="${POSTGRES_ENABLE:-true}"
DB_USER="${DB_USER:-smt_user}"
DB_PASS="${DB_PASS:-smt_password}"
DB_NAME="${DB_NAME:-smt_hub}"

# Port applicatif
APP_PORT="${APP_PORT:-4000}"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction de sauvegarde
backup() {
    log "Création de la sauvegarde..."
    
    # Créer le répertoire de backup s'il n'existe pas
    sudo mkdir -p $BACKUP_DIR
    
    # Créer la sauvegarde avec timestamp
    BACKUP_NAME="smt-hub-$(date +%Y%m%d_%H%M%S).tar.gz"
    sudo tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C $APP_DIR data/ 2>/dev/null || warning "Aucune donnée à sauvegarder"
    
    success "Sauvegarde créée: $BACKUP_NAME"
}

# Fonction de vérification des prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Installer paquets de base si absents (RedHat/CentOS)
    if command -v dnf &>/dev/null; then
        sudo dnf install -y git curl tar >/dev/null 2>&1 || true
    fi
    
    # Node.js
    if ! command -v node &> /dev/null; then
        warning "Node.js absent - installation en cours (Node 18.x)"
        if command -v dnf &>/dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - >/dev/null 2>&1 || true
            sudo dnf install -y nodejs >/dev/null 2>&1 || true
        fi
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        error "npm n'est pas disponible après installation"
        exit 1
    fi
    
    # PM2
    if ! command -v pm2 &> /dev/null; then
        warning "PM2 absent - installation en cours"
        sudo npm install -g pm2 >/dev/null 2>&1 || true
    fi
    
    # Préparer répertoires
    sudo mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
    sudo chown -R "$(whoami)":"$(whoami)" "$APP_DIR" "$LOG_DIR" || true
    
    success "Tous les prérequis sont satisfaits"
}

# Installation de base sur RedHat/CentOS (Nginx, Firewalld, SELinux tools, PostgreSQL)
install_redhat_stack() {
    log "Installation des paquets système (Nginx, PostgreSQL, outils) ..."
    if command -v dnf &>/dev/null; then
        sudo dnf update -y || true
        sudo dnf install -y nginx firewalld policycoreutils-python-utils git curl wget unzip || true
        if [ "$POSTGRES_ENABLE" = "true" ]; then
            sudo dnf install -y postgresql-server postgresql-contrib || true
            # Initialiser PostgreSQL si nécessaire
            if [ ! -d "/var/lib/pgsql/data" ] && [ -x "/usr/bin/postgresql-setup" ]; then
                sudo postgresql-setup --initdb || true
            fi
            sudo systemctl enable postgresql || true
            sudo systemctl start postgresql || true
        fi
        sudo systemctl enable nginx || true
        sudo systemctl start nginx || true
    else
        warning "dnf introuvable. Assure-toi d'être sur RedHat/CentOS."
    fi
}

# Configuration PostgreSQL (création base + utilisateur)
setup_postgres() {
    [ "$POSTGRES_ENABLE" != "true" ] && return 0
    log "Configuration PostgreSQL (DB: $DB_NAME, USER: $DB_USER) ..."
    # Créer l'utilisateur si absent
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
    # Créer la base si absente
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true
}

# Configuration Nginx (reverse proxy -> Next.js sur APP_PORT)
setup_nginx() {
    log "Configuration Nginx (proxy vers 127.0.0.1:$APP_PORT) ..."
    NGINX_CONF_PATH="/etc/nginx/conf.d/smt-hub.conf"
    sudo tee "$NGINX_CONF_PATH" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    access_log /var/log/nginx/smt-hub.access.log;
    error_log  /var/log/nginx/smt-hub.error.log;

    # Sécurité basique
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
EOF
    sudo nginx -t && sudo systemctl reload nginx || warning "Nginx reload a échoué, vérifie la conf"
}

# Firewall + SELinux (ouvrir 80 et APP_PORT ; autoriser connexions sortantes d'httpd)
setup_firewall_selinux() {
    log "Configuration FirewallD et SELinux ..."
    if command -v firewall-cmd &>/dev/null; then
        sudo firewall-cmd --permanent --add-service=http || true
        sudo firewall-cmd --permanent --add-port=${APP_PORT}/tcp || true
        sudo firewall-cmd --reload || true
    fi
    # Autoriser Nginx à ouvrir des connexions sortantes (vers Node)
    if command -v setsebool &>/dev/null; then
        sudo setsebool -P httpd_can_network_connect 1 || true
    fi
    # Autoriser port applicatif si nécessaire
    if command -v semanage &>/dev/null; then
        sudo semanage port -a -t http_port_t -p tcp ${APP_PORT} 2>/dev/null || true
    fi
}

# PM2 - démarrage au boot
pm2_bootstrap() {
    log "Configuration PM2 au démarrage ..."
    pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true
    pm2 save || true
    # Optionnel: logrotate
    pm2 install pm2-logrotate >/dev/null 2>&1 || true
    pm2 set pm2-logrotate:max_size 10M >/dev/null 2>&1 || true
    pm2 set pm2-logrotate:retain 30 >/dev/null 2>&1 || true
}

# Clonage / mise à jour du dépôt
ensure_repo() {
    log "Préparation du dépôt Git..."
    if [ ! -d "$APP_DIR/.git" ]; then
        cd "$APP_DIR"
        CLONE_URL="$REPO_URL"
        if [ -n "$GITHUB_TOKEN" ]; then
            # injecter le token dans l'URL en évitant toute sortie console
            CLONE_URL=$(echo "$REPO_URL" | sed -E "s#https://#https://$GITHUB_TOKEN@#")
        fi
        log "Clonage du dépôt (branche: $BRANCH)"
        git clone --depth=1 --branch "$BRANCH" "$CLONE_URL" . || {
            error "Échec du clonage du dépôt"
            exit 1
        }
        # Reconfigurer l'URL distante sans afficher le token
        git remote set-url origin "$REPO_URL"
    else
        cd "$APP_DIR"
        log "Mise à jour du dépôt existant"
        if [ -n "$GITHUB_TOKEN" ]; then
            git remote set-url origin "$(echo "$REPO_URL" | sed -E "s#https://#https://$GITHUB_TOKEN@#")"
            git fetch origin "$BRANCH" --quiet || true
            git checkout "$BRANCH" --quiet || true
            git pull origin "$BRANCH" --quiet || true
            # Restaurer URL propre (sans token)
            git remote set-url origin "$REPO_URL"
        else
            git fetch origin "$BRANCH" --quiet || true
            git checkout "$BRANCH" --quiet || true
            git pull origin "$BRANCH" --quiet || true
        fi
    fi
}

# Fonction de déploiement
deploy() {
    log "🚀 Démarrage du déploiement SMT HUB..."
    
    # Préparer/cloner le dépôt
    ensure_repo
    
    # Aller dans le répertoire de l'application
    cd $APP_DIR
    
    # Arrêter l'application si elle tourne
    if pm2 list | grep -q $APP_NAME; then
        log "Arrêt de l'application..."
        pm2 stop $APP_NAME
    fi
    
    # Sauvegarde avant déploiement
    backup
    
    # Copier env par défaut si absent
    if [ ! -f ".env.production" ] && [ -f "env.production.example" ]; then
        log "Création de .env.production depuis env.production.example"
        cp env.production.example .env.production || true
    fi
    # Injecter DATABASE_URL si PostgreSQL activé et non défini
    if [ "$POSTGRES_ENABLE" = "true" ]; then
        if ! grep -q "^DATABASE_URL=" .env.production 2>/dev/null; then
            echo "DATABASE_TYPE=postgresql" >> .env.production
            echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" >> .env.production
        fi
    fi
    
    # Installation des dépendances
    log "Installation des dépendances..."
    npm ci --only=production || npm install --production
    
    # Build de l'application
    log "Build de l'application..."
    npm run build
    
    # Vérifier que le build s'est bien passé
    if [ ! -d ".next" ]; then
        error "Le build a échoué"
        exit 1
    fi
    
    # Démarrer l'application
    log "Démarrage de l'application..."
    pm2 start ecosystem.config.js
    
    # Sauvegarder la configuration PM2
    pm2 save
    
    success "Déploiement terminé avec succès!"
}

# Fonction de vérification post-déploiement
verify_deployment() {
    log "Vérification du déploiement..."
    
    # Attendre que l'application démarre
    sleep 5
    
    # Vérifier le statut PM2
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Application démarrée avec succès"
    else
        error "L'application n'a pas démarré correctement"
        pm2 logs $APP_NAME --lines 20
        exit 1
    fi
    
    # Test de connectivité
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 | grep -q "200\|302"; then
        success "Application accessible sur le port 4000"
    else
        warning "L'application n'est pas accessible sur le port 4000"
    fi
    
    # Vérifier les logs
    if [ -f "$LOG_DIR/out.log" ]; then
        log "Dernières lignes des logs:"
        tail -n 5 "$LOG_DIR/out.log"
    fi
}

# Fonction de nettoyage
cleanup() {
    log "Nettoyage des anciennes sauvegardes..."
    
    # Supprimer les sauvegardes de plus de 30 jours
    find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true
    
    # Nettoyer les logs anciens
    find $LOG_DIR -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    success "Nettoyage terminé"
}

# Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  deploy     Déployer l'application"
    echo "  backup     Créer une sauvegarde"
    echo "  verify     Vérifier le déploiement"
    echo "  cleanup    Nettoyer les anciens fichiers"
    echo "  restart    Redémarrer l'application"
    echo "  logs       Afficher les logs"
    echo "  status     Afficher le statut"
    echo "  help       Afficher cette aide"
    echo ""
}

# Fonction pour afficher les logs
show_logs() {
    if pm2 list | grep -q $APP_NAME; then
        pm2 logs $APP_NAME --lines 50
    else
        error "L'application n'est pas en cours d'exécution"
    fi
}

# Fonction pour afficher le statut
show_status() {
    echo "=== Statut de SMT HUB ==="
    echo ""
    
    # Statut PM2
    echo "📊 Statut PM2:"
    pm2 list | grep $APP_NAME || echo "Application non trouvée"
    echo ""
    
    # Utilisation des ressources
    echo "💾 Utilisation des ressources:"
    pm2 monit --no-daemon --timeout 5 || echo "Impossible d'afficher les métriques"
    echo ""
    
    # Logs récents
    echo "📋 Logs récents:"
    if [ -f "$LOG_DIR/out.log" ]; then
        tail -n 10 "$LOG_DIR/out.log"
    else
        echo "Aucun log disponible"
    fi
}

# Fonction de redémarrage
restart() {
    log "Redémarrage de l'application..."
    
    if pm2 list | grep -q $APP_NAME; then
        pm2 restart $APP_NAME
        success "Application redémarrée"
    else
        error "L'application n'est pas en cours d'exécution"
        exit 1
    fi
}

# Gestion des arguments
case "${1:-deploy}" in
    bootstrap)
        check_prerequisites
        install_redhat_stack
        setup_firewall_selinux
        setup_postgres
        setup_nginx
        deploy
        pm2_bootstrap
        verify_deployment
        ;;
    deploy)
        check_prerequisites
        install_redhat_stack
        setup_firewall_selinux
        [ "$POSTGRES_ENABLE" = "true" ] && setup_postgres || true
        setup_nginx
        deploy
        pm2_bootstrap
        verify_deployment
        ;;
    backup)
        backup
        ;;
    verify)
        verify_deployment
        ;;
    cleanup)
        cleanup
        ;;
    restart)
        restart
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Option invalide: $1"
        show_help
        exit 1
        ;;
esac 