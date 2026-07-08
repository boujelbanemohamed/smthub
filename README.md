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

## 🚀 Démarrage rapide

Prérequis : **Node.js 18+**.

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement (voir ci-dessous)
cp env.production.example .env.local   # puis éditez les valeurs

# 3. Créer un premier administrateur (aucun compte par défaut)
ADMIN_EMAIL=admin@votre-domaine.com ADMIN_PASSWORD='UnMotDePasseFort!' npm run seed:admin

# 4. Lancer en développement
npm run dev
# → http://localhost:4000
```

## 🔐 Variables d'environnement

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `SESSION_SECRET` | ✅ (prod) | Secret de signature des sessions (JWT). `openssl rand -base64 48` |
| `CREDENTIALS_SECRET` | ✅ (prod) | Clé de chiffrement du coffre-fort d'identifiants. `openssl rand -base64 48` |
| `DATABASE_URL` | Optionnel | Connexion PostgreSQL. Absente → mode fichier JSON. |
| `SMTP_PASS` | Optionnel | Mot de passe SMTP (sinon dans la config SMTP). |
| `NEXT_PUBLIC_APP_URL` | Recommandé | URL publique (liens dans les emails). |

> ⚠️ Ne commitez jamais les secrets. `.env*`, `data/smtp-config.json` et
> `data/app-credentials.json` sont ignorés par Git.

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
