// Classification des événements sensibles pour le Journal d'audit.
// Seules les actions listées ici apparaissent dans l'audit (le reste = bruit).

export type AuditCategory =
  | "Authentification"
  | "Sécurité"
  | "Accès"
  | "Utilisateurs"
  | "Applications"
  | "Banques"
  | "Configuration"

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "Authentification",
  "Sécurité",
  "Accès",
  "Utilisateurs",
  "Applications",
  "Banques",
  "Configuration",
]

// action -> catégorie d'audit
const MAP: Record<string, AuditCategory> = {
  // Authentification
  Login: "Authentification",
  Logout: "Authentification",
  "2FA": "Authentification",
  "Mot de passe oublié": "Authentification",
  "Réinitialisation mot de passe": "Authentification",
  // Sécurité (config, verrouillages, overrides 2FA)
  "Sécurité": "Sécurité",
  // Accès applicatifs
  "Accord d'accès": "Accès",
  "Accord d'accès groupé": "Accès",
  "Révocation d'accès": "Accès",
  "Révocation d'accès groupée": "Accès",
  // Utilisateurs
  "Création utilisateur": "Utilisateurs",
  "Suppression utilisateur": "Utilisateurs",
  "Mise à jour profil": "Utilisateurs",
  "Import utilisateurs": "Utilisateurs",
  "Création groupe": "Utilisateurs",
  "Mise à jour groupe": "Utilisateurs",
  "Suppression groupe": "Utilisateurs",
  // Applications
  "Création application": "Applications",
  "Mise à jour application": "Applications",
  "Suppression application": "Applications",
  "Import applications": "Applications",
  "Chargement code application": "Applications",
  "Téléchargement code application": "Applications",
  "Suppression code application": "Applications",
  "Coffre-fort": "Applications",
  // Banques
  "Création banque": "Banques",
  "Modification banque": "Banques",
  "Suppression banque": "Banques",
  "Import banque": "Banques",
  // Configuration / sauvegardes / rapports
  "Création sauvegarde": "Configuration",
  "Restauration sauvegarde": "Configuration",
  "Suppression sauvegarde": "Configuration",
  "Téléchargement sauvegarde": "Configuration",
  "Rapports planifiés": "Configuration",
  "Création catégorie": "Configuration",
  "Modification catégorie": "Configuration",
  "Suppression catégorie": "Configuration",
  "Création annonce": "Configuration",
  "Modification annonce": "Configuration",
  "Suppression annonce": "Configuration",
}

export function auditCategory(action: string): AuditCategory | null {
  return MAP[action] || null
}

export function isAuditable(action: string): boolean {
  return !!MAP[action]
}
