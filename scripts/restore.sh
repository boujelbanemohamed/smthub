#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Restauration d'une sauvegarde de SMT HUB créée par scripts/backup.sh.
#
# ⚠️ Remplace les données actuelles. Par sécurité, les données existantes sont
# d'abord déplacées vers data.avant-restauration-<horodatage> (jamais écrasées).
#
# Usage :
#   bash scripts/restore.sh /var/backups/smt-hub/smthub-backup-AAAA-MM-JJ_HH-MM-SS.tar.gz
#
# Variables d'environnement (optionnelles) :
#   APP_DIR   Racine du projet   (défaut : /var/www/smt-hub)
#   FORCE     1 = ne pas demander de confirmation
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/smt-hub}"
archive="${1:-}"

if [ -z "$archive" ]; then
  echo "Usage : bash scripts/restore.sh <archive.tar.gz>" >&2
  exit 1
fi
if [ ! -f "$archive" ]; then
  echo "❌ Archive introuvable : $archive" >&2
  exit 1
fi

# Vérification d'intégrité avant toute modification.
if ! tar -tzf "$archive" >/dev/null 2>&1; then
  echo "❌ Archive illisible ou corrompue : $archive" >&2
  exit 1
fi

echo "Vous allez restaurer :"
echo "   Archive : $archive"
echo "   Vers    : $APP_DIR"
echo "Les données actuelles seront déplacées (sauvegardées), pas supprimées."
if [ "${FORCE:-0}" != "1" ]; then
  read -r -p "Confirmer la restauration ? (oui/non) " ans
  [ "$ans" = "oui" ] || { echo "Annulé."; exit 0; }
fi

ts="$(date +%Y-%m-%d_%H-%M-%S)"
if [ -d "$APP_DIR/data" ]; then
  mv "$APP_DIR/data" "$APP_DIR/data.avant-restauration-$ts"
  echo "ℹ️  Données actuelles déplacées vers : $APP_DIR/data.avant-restauration-$ts"
fi

tar -xzf "$archive" -C "$APP_DIR"

echo "✅ Restauration terminée."
echo "   Redémarrez l'application :  pm2 reload smt-hub"
echo "   Si tout est OK, vous pourrez supprimer : $APP_DIR/data.avant-restauration-$ts"
