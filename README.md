# SMT HUB — Portail d'applications (Monétique Tunisie)

Portail web centralisé permettant aux utilisateurs d'accéder à leurs applications
métier depuis un seul endroit, avec gestion des comptes, des accès et un
coffre-fort d'identifiants personnel. Construit avec **Next.js 14** (App Router),
**TypeScript**, **Tailwind CSS** et **shadcn/ui**.

## ✨ Fonctionnalités

- **Authentification** par session signée (JWT via `jose`), mots de passe hachés (bcrypt).
- **Rôles** : administrateur / utilisateur, avec protection des routes (middleware + `requireAdmin`).
- **Portail utilisateur** : accès aux applications autorisées, thème clair/sombre.
- **Coffre-fort d'identifiants** : chaque utilisateur enregistre login/mot de passe/note
  par application, **chiffrés au repos (AES-256-GCM)**, visibles par lui seul.
- **Avatars** : photo téléversée ou initiales colorées (profil + gestion admin).
- **Administration** : gestion des utilisateurs, des applications (logo, ordre
  d'affichage par flèches ↑/↓), des accès, des templates d'emails et du SMTP.
- **Mot de passe oublié** : lien de réinitialisation à usage unique par email.
- **Emails transactionnels** : activation de compte, réinitialisation, notifications d'accès.
- **Double persistance** : mode fichier JSON (par défaut) ou **PostgreSQL** (Prisma).

## 🛠️ Stack technique

| Domaine | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| Auth / crypto | jose (JWT), bcryptjs, AES-256-GCM (Node crypto) |
| ORM (option) | Prisma + PostgreSQL |
| Emails | Nodemailer (SMTP) |

## 🚀 Démarrage rapide (développement)

Prérequis : **Node.js 18.17+ ou 20 LTS**.

```bash
# 1. Installer les dépendances
npm install

# 2. Créer votre configuration à partir du modèle documenté
cp .env.example .env.local

# 3. Générer les 2 secrets obligatoires et les coller dans .env.local
openssl rand -base64 48   # → SESSION_SECRET
openssl rand -base64 48   # → CREDENTIALS_SECRET

# 4. Créer un premier administrateur (aucun compte par défaut n'est livré)
ADMIN_EMAIL=admin@votre-domaine.com ADMIN_PASSWORD='UnMotDePasseFort!' npm run seed:admin

# 5. Lancer en développement
npm run dev
# → http://localhost:4000
```

## 🖥️ Installation en production (Red Hat / RHEL 8-9)

Guide résumé (détails et durcissement dans [`DEPLOYMENT_REDHAT.md`](./DEPLOYMENT_REDHAT.md)).

```bash
# 1. Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# 2. Récupérer le code
git clone https://github.com/boujelbanemohamed/smthub.git
cd smthub

# 3. Dépendances + configuration
npm install
cp .env.example .env
#   → éditez .env : NODE_ENV=production, SESSION_SECRET, CREDENTIALS_SECRET,
#     NEXT_PUBLIC_APP_URL (et DATABASE_URL si PostgreSQL)

# 4. (Option PostgreSQL) créer la base puis :
#   npx prisma db push

# 5. Premier administrateur
ADMIN_EMAIL=admin@mon-domaine.com ADMIN_PASSWORD='MotDePasseFort!' npm run seed:admin

# 6. Build + lancement
npm run build
npm run start        # écoute sur le port 4000
```

**Recommandé en production :**
- **Reverse proxy nginx + HTTPS** devant le port 4000 — exemple fourni : [`nginx-smt-hub.conf`](./nginx-smt-hub.conf). Cookies de session `secure` → HTTPS obligatoire.
- **Gestionnaire de processus** : PM2 ([`ecosystem.config.js`](./ecosystem.config.js)) ou service **systemd** ([`systemd-smt-hub.service`](./systemd-smt-hub.service)).
- **SELinux** : `sudo setsebool -P httpd_can_network_connect 1` (proxy nginx).
- **Firewalld** : ouvrir 80/443 (`sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload`).
- **PostgreSQL 13+** conseillé pour un usage multi-utilisateurs durable ; le mode fichier JSON convient à un serveur unique.

> Le dossier `data/` (données applicatives) et les fichiers `.env*` ne sont pas
> versionnés : sauvegardez-les séparément lors des mises à jour.

## 🔐 Variables d'environnement

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `SESSION_SECRET` | ✅ (prod) | Secret de signature des sessions (JWT). `openssl rand -base64 48` |
| `CREDENTIALS_SECRET` | ✅ (prod) | Clé de chiffrement du coffre-fort d'identifiants. `openssl rand -base64 48` |
| `DATABASE_URL` | Optionnel | Connexion PostgreSQL. Absente → mode fichier JSON. |
| `SMTP_PASS` | Optionnel | Mot de passe SMTP (sinon dans la config SMTP). |
| `NEXT_PUBLIC_APP_URL` | Recommandé | URL publique (liens dans les emails). |

Le fichier [`.env.example`](./.env.example) documente **toutes** les variables
(obligatoires, base de données, SMTP, sauvegardes, scripts).

> ⚠️ Ne commitez jamais les secrets ni les données. Les fichiers `.env*`
> (sauf `.env.example`) et le dossier `data/` sont ignorés par Git.

## 📜 Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement (port 4000) |
| `npm run build` / `npm start` | Build et lancement en production |
| `npm run seed:admin` | Créer/mettre à jour un administrateur (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) |
| `npm run reset:password` | Réinitialiser un mot de passe (`USER_EMAIL`, `NEW_PASSWORD`) |
| `npm run prisma:generate` / `prisma:push` | Générer le client / pousser le schéma (mode PostgreSQL) |

## 📧 Configuration des emails (SMTP)

Depuis l'interface : **Admin → Configuration Emails** → renseigner le serveur →
**Tester la configuration**. Procédure détaillée (Gmail, Outlook, OVH) dans
[`SMTP.md`](./SMTP.md).

## 📦 Déploiement

- Servir impérativement derrière **HTTPS** (cookies de session `secure`).
- **PostgreSQL** recommandé en serverless (le mode fichier n'est pas persistant).
- Voir [`PRODUCTION.md`](./PRODUCTION.md) pour la checklist complète.

## 📁 Structure du projet

```
app/            Pages et routes API (App Router)
components/     Composants UI (dont shadcn/ui)
lib/            Logique métier (auth, sessions, crypto, emails, stores)
data/           Persistance fichier JSON (mode par défaut)
prisma/         Schéma PostgreSQL
scripts/        Scripts CLI (seed admin, reset password)
```

## 📄 Documentation complémentaire

- [`PRODUCTION.md`](./PRODUCTION.md) — checklist de mise en production
- [`SMTP.md`](./SMTP.md) — configuration de l'envoi d'emails
- [`DATABASE_MIGRATION.md`](./DATABASE_MIGRATION.md) — migration vers PostgreSQL
