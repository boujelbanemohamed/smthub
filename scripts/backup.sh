#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sauvegarde automatique des données de SMT HUB.
#
# Archive le dossier `data/` (toutes les données : utilisateurs, applications,
# coffre-fort chiffré, dépôts de code, annonces, logs…) et, par défaut, le
# fichier de secrets `.env.production` — INDISPENSABLE pour pouvoir restaurer
# le coffre-fort chiffré (sans CREDENTIALS_SECRET, les identifiants stockés
# sont illisibles).
#
# Usage :
#   bash scripts/backup.sh
#
# Variables d'environnement (optionnelles) :
#   APP_DIR         Racine du projet          (défaut : /var/www/smt-hub)
#   BACKUP_DIR      Dossier des sauvegardes   (défaut : <APP_DIR>/backups)
#   RETENTION_DAYS  Jours de rétention        (défaut : 14)
#   INCLUDE_ENV     Inclure .env.production   (défaut : 1 ; mettre 0 pour exclure)
#
# ℹ️ Le dossier de sauvegarde par défaut (<APP_DIR>/backups) est le MÊME que
#    celui lu par le panneau « Sauvegardes » de l'admin : les sauvegardes du
#    cron y sont donc visibles et téléchargeables depuis l'interface. Si vous
#    changez BACKUP_DIR, définissez la même valeur dans .env.production.
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/smt-hub}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
INCLUDE_ENV="${INCLUDE_ENV:-1}"

if [ ! -d "$APP_DIR/data" ]; then
  echo "❌ Dossier de données introuvable : $APP_DIR/data" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
ts="$(date +%Y-%m-%d_%H-%M-%S)"
archive="$BACKUP_DIR/smthub-backup-$ts.tar.gz"

# Liste des éléments à sauvegarder (chemins relatifs à APP_DIR).
items=("data")
if [ "$INCLUDE_ENV" = "1" ] && [ -f "$APP_DIR/.env.production" ]; then
  items+=(".env.production")
fi

# Création de l'archive compressée.
tar -czf "$archive" -C "$APP_DIR" "${items[@]}"
# L'archive contient des secrets → accès restreint au propriétaire.
chmod 600 "$archive"

# Vérification d'intégrité (l'archive doit être lisible de bout en bout).
if ! tar -tzf "$archive" >/dev/null 2>&1; then
  echo "❌ Archive corrompue, suppression : $archive" >&2
  rm -f "$archive"
  exit 1
fi

# Rotation : supprime les sauvegardes plus vieilles que RETENTION_DAYS jours.
find "$BACKUP_DIR" -maxdepth 1 -name 'smthub-backup-*.tar.gz' -type f -mtime +"$RETENTION_DAYS" -delete

size="$(du -h "$archive" | cut -f1)"
echo "✅ Sauvegarde créée : $archive ($size)"
echo "   Rétention : $RETENTION_DAYS jours — dossier : $BACKUP_DIR"
