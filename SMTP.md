# Configuration de l'envoi d'emails (SMTP)

Ce guide explique comment configurer et tester l'envoi d'emails de SMT HUB /
Monétique Tunisie (emails d'activation de compte, mot de passe oublié,
notifications d'accès).

## Principe

L'application ne possède pas de serveur de mail : elle se connecte au **serveur
SMTP** d'un fournisseur (Gmail, Outlook, OVH, votre serveur d'entreprise…) pour
envoyer les emails en votre nom.

Tant qu'aucun SMTP n'est configuré, les emails ne sont **pas** envoyés (l'action
est simplement tracée dans les logs, sans bloquer l'application).

## Étapes

1. Connectez-vous en **administrateur**.
2. Allez dans **Admin → onglet « Configuration Emails »**.
3. Renseignez les paramètres SMTP (voir tableaux ci-dessous selon le fournisseur).
4. Cliquez sur **« Sauvegarder la configuration »**.
5. Cliquez sur **« Tester la configuration »** : un email de test est envoyé à
   l'adresse configurée.
   - **Email reçu** → ✅ le SMTP fonctionne, tous les emails automatiques partiront.
   - **Erreur** → le message affiché indique quoi corriger (voir « Dépannage »).

## Paramètres par fournisseur

### Gmail
| Champ | Valeur |
|-------|--------|
| Serveur SMTP | `smtp.gmail.com` |
| Port | `587` |
| SSL/TLS | décoché (STARTTLS) — ou port `465` + coché |
| Utilisateur | votre adresse `@gmail.com` |
| Mot de passe | **mot de passe d'application** (voir ci-dessous) |

> ⚠️ Gmail refuse votre mot de passe habituel. Il faut :
> 1. Activer la **validation en 2 étapes** sur le compte Google.
> 2. Générer un **mot de passe d'application** sur
>    https://myaccount.google.com/apppasswords
> 3. Utiliser ce mot de passe (16 caractères) dans le champ « Mot de passe ».

### Outlook / Microsoft 365
| Champ | Valeur |
|-------|--------|
| Serveur SMTP | `smtp.office365.com` |
| Port | `587` |
| SSL/TLS | décoché (STARTTLS) |
| Utilisateur | votre adresse Outlook/365 |
| Mot de passe | mot de passe du compte (ou mot de passe d'application si MFA activé) |

### OVH
| Champ | Valeur |
|-------|--------|
| Serveur SMTP | `ssl0.ovh.net` |
| Port | `465` |
| SSL/TLS | coché |
| Utilisateur | l'adresse email complète |
| Mot de passe | mot de passe de la boîte email |

### Serveur SMTP d'entreprise
Demandez à votre service informatique : l'hôte, le port, le mode de chiffrement
(SSL/TLS ou STARTTLS) et un compte d'envoi dédié.

## Règle port / chiffrement

- **Port 465** → SSL/TLS **coché**
- **Port 587** → SSL/TLS **décoché** (STARTTLS, négocié automatiquement)

Une incohérence entre les deux est la cause d'erreur la plus fréquente.

## Sécurité du mot de passe SMTP

- Le mot de passe SMTP n'est **jamais renvoyé** à l'interface (le formulaire le
  laisse vide au rechargement ; le laisser vide à la sauvegarde conserve l'ancien).
- En production, préférez le fournir via la variable d'environnement **`SMTP_PASS`**
  (elle a priorité sur la valeur du fichier), pour ne pas stocker le secret en clair.

## Dépannage (messages du bouton « Tester »)

| Message | Cause probable | Solution |
|---------|----------------|----------|
| Authentification refusée / mot de passe d'application requis | Mauvais identifiants, ou 2FA active | Utilisez un **mot de passe d'application** |
| Connexion refusée | Mauvais port/hôte | Vérifiez hôte + port (587 ou 465) |
| Délai dépassé | Port bloqué par un pare-feu | Ouvrez le SMTP sortant ou changez de port |
| Serveur SMTP introuvable | Faute dans l'adresse | Corrigez l'hôte (ex: `smtp.gmail.com`) |
| Erreur SSL/TLS | Incohérence port/chiffrement | 465 = SSL coché, 587 = SSL décoché |

## Note pour l'hébergement serverless

Certaines plateformes (ex. Vercel) **bloquent le SMTP sortant** sur les ports
25/465/587. Dans ce cas, utilisez un service d'envoi via **API HTTPS**
(SendGrid, Mailgun, Resend, Amazon SES…) plutôt que le SMTP direct.
