# Sauvegarde & restauration — SMT HUB

> 💡 **Deux façons de sauvegarder :**
> 1. **Depuis l'admin** (onglet « Sauvegardes ») — recommandé : créer/lister/
>    télécharger/supprimer/**restaurer** une sauvegarde, et **planifier** la
>    sauvegarde automatique (fréquence, heure, rétention). Le planificateur est
>    intégré à l'application : **aucun cron système n'est nécessaire** si vous
>    l'utilisez.
> 2. **En ligne de commande** (ci-dessous) — utile pour un cron système
>    classique ou une restauration en SSH. Le dossier est le même (`<projet>/
>    backups`), donc les deux méthodes voient les mêmes archives.
>
> N'activez qu'**une seule** des deux planifications (UI *ou* cron système) pour
> éviter les doubles sauvegardes.


Le dossier `data/` **est** la base de données de l'application (utilisateurs,
applications, coffre-fort chiffré, dépôts de code, annonces, logs). Il doit être
sauvegardé régulièrement. Le fichier de secrets `.env.production` est inclus dans
la sauvegarde car il est **indispensable** pour relire le coffre-fort chiffré.

## Sauvegarde manuelle

```bash
cd /var/www/smt-hub
bash scripts/backup.sh
# → crée backups/smthub-backup-AAAA-MM-JJ_HH-MM-SS.tar.gz
```

> 💡 Le dossier de sauvegarde par défaut (`<projet>/backups`) est **le même**
> que celui lu par le panneau **« Sauvegardes »** de l'admin : les sauvegardes
> automatiques du cron y sont donc **visibles et téléchargeables** depuis
> l'interface. Si vous changez `BACKUP_DIR`, mettez la **même valeur** dans
> `.env.production` pour que l'admin les voie aussi.

Options (variables d'environnement) :

| Variable | Défaut | Rôle |
|---|---|---|
| `APP_DIR` | `/var/www/smt-hub` | Racine du projet |
| `BACKUP_DIR` | `<APP_DIR>/backups` | Où stocker les archives (idem panneau admin) |
| `RETENTION_DAYS` | `14` | Suppression auto des archives plus vieilles |
| `INCLUDE_ENV` | `1` | Inclure `.env.production` (mettre `0` pour exclure) |

Exemple : conserver 30 jours dans un autre dossier :
```bash
BACKUP_DIR=/mnt/backups/smthub RETENTION_DAYS=30 bash scripts/backup.sh
```

## Sauvegarde automatique quotidienne (cron)

```bash
# Rendre les scripts exécutables (une seule fois)
chmod +x /var/www/smt-hub/scripts/backup.sh /var/www/smt-hub/scripts/restore.sh

# Éditer la crontab
crontab -e
```

Ajouter cette ligne (sauvegarde tous les jours à 02h00, log dans un fichier) :

```cron
0 2 * * * cd /var/www/smt-hub && /usr/bin/env bash scripts/backup.sh >> /var/log/smt-hub/backup.log 2>&1
```

Vérifier ensuite : `crontab -l` et, après la première exécution,
`ls -lh /var/backups/smt-hub/`.

## Restauration

```bash
cd /var/www/smt-hub
bash scripts/restore.sh backups/smthub-backup-AAAA-MM-JJ_HH-MM-SS.tar.gz
pm2 reload smt-hub
```

> La restauration reste **volontairement en ligne de commande** (opération rare
> et sensible qui remplace les données en cours). Le panneau admin permet de
> créer, lister, télécharger et supprimer des sauvegardes — mais pas de
> restaurer.

Les données actuelles sont d'abord **déplacées** vers
`data.avant-restauration-<horodatage>` (jamais supprimées) : en cas d'erreur,
vous pouvez revenir en arrière.

## ⚠️ Bonnes pratiques

- **Testez une restauration** au moins une fois : une sauvegarde jamais restaurée
  n'est pas fiable.
- **Copie hors serveur** : les archives contiennent vos secrets. Copiez-les
  régulièrement sur un autre support/serveur (un incident disque ne doit pas
  emporter à la fois les données ET les sauvegardes).
- **Surveillez l'espace disque** de `BACKUP_DIR` (les dépôts de code peuvent
  rendre les archives volumineuses).
