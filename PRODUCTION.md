# Checklist de mise en production — SMT HUB

Ce document liste les étapes obligatoires et les points d'attention avant
de déployer SMT HUB en production.

## 1. Variables d'environnement obligatoires

| Variable          | Obligatoire | Rôle |
|-------------------|-------------|------|
| `SESSION_SECRET`  | ✅ Oui      | Secret de signature du cookie de session (JWT). **L'application refuse de démarrer une session en production sans cette variable.** |
| `ADMIN_EMAIL`     | ✅ Oui*     | Email du premier administrateur (utilisé par `npm run seed:admin`). |
| `ADMIN_PASSWORD`  | ✅ Oui*     | Mot de passe du premier administrateur (haché avec bcrypt par le script). |
| `DATABASE_URL`    | Recommandé  | Connexion PostgreSQL. Si absente, l'app bascule en mode fichier JSON. |
| `DATABASE_TYPE`   | Optionnel   | Mettre `postgresql` pour forcer le mode base de données. |

\* requis uniquement pour exécuter le script de création de l'admin.

Générer un `SESSION_SECRET` fort :

```bash
openssl rand -base64 48
```

## 2. Compte administrateur (aucun identifiant par défaut)

Pour des raisons de sécurité, **aucun compte admin connu n'est livré** dans le
code. Les anciens comptes de démonstration (`admin@smt.com`, `user@smt.com`)
ont été supprimés. Créez votre administrateur :

```bash
ADMIN_EMAIL=admin@votre-domaine.com \
ADMIN_PASSWORD='UnMotDePasseFort!' \
npm run seed:admin
```

Le script détecte automatiquement la cible :
- **PostgreSQL** si `DATABASE_URL`/`DATABASE_TYPE=postgresql` est défini (upsert) ;
- **fichier `data/users.json`** sinon.

## 3. Génération du client Prisma

Le client Prisma est généré automatiquement à l'installation via le script
`postinstall`. Si besoin, le relancer manuellement :

```bash
npm install          # déclenche `prisma generate`
npm run prisma:generate
npm run prisma:push  # synchronise le schéma avec la base (mode PostgreSQL)
```

> Remarque : la génération télécharge des binaires depuis `binaries.prisma.sh`.
> Assurez-vous que votre environnement de build y a accès réseau.

## 4. Choix du mode de persistance selon l'hébergement

| Hébergement | Mode recommandé | Pourquoi |
|-------------|-----------------|----------|
| Serverless (Vercel, Netlify, conteneurs éphémères) | **PostgreSQL** (`DATABASE_URL`) | Le système de fichiers est éphémère : en mode JSON, les écritures dans `data/*.json` sont perdues et non partagées entre instances. |
| Serveur unique persistant (VPS, VM) | PostgreSQL ou mode fichier JSON | Le mode fichier fonctionne tant qu'un seul processus écrit sur un disque persistant. |

### Rate limiting

Le rate limiting des connexions (`lib/auth.ts`) est **en mémoire, par instance** :
- il est remis à zéro à chaque redémarrage ;
- il n'est pas partagé entre plusieurs instances.

Pour un déploiement **multi-instances / serverless**, remplacer le stockage du
compteur par un magasin externe (Redis, Upstash). Pour un serveur unique, le
comportement actuel est suffisant.

## 5. Build & démarrage

```bash
npm install
npm run build
npm start
```

Servir impérativement derrière **HTTPS** : en production, le cookie de session
est émis avec l'attribut `secure`, donc il n'est transmis que sur des connexions
chiffrées.

## 6. Points de configuration à connaître

- `next.config.mjs` contient `typescript.ignoreBuildErrors: true` et
  `eslint.ignoreDuringBuilds: true`. Le build n'échoue donc pas sur une erreur
  de type ou de lint. Lancer `npx tsc --noEmit` en intégration continue pour
  détecter les régressions de typage.
- Configurer le SMTP (`SMTP_*`) pour l'envoi des emails (bienvenue, changements
  d'accès). Sans configuration valide, ces envois échouent silencieusement sans
  bloquer les opérations.

## 7. Vérifications de sécurité déjà en place

- Cookie de session signé (JWT, `jose`) — non falsifiable côté client.
- Mots de passe hachés avec bcrypt ; vérification du mot de passe actuel avant
  changement depuis la page Profil.
- Endpoints d'administration protégés par `requireAdmin()`.
- Upload de fichiers validé par signature binaire (magic bytes) + filtrage des
  charges utiles SVG ; nom de fichier généré côté serveur.
- Rate limiting sur la route de connexion.
