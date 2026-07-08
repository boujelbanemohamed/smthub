// Configuration des optimisations de performance
export const PERFORMANCE_CONFIG = {
  // Cache TTL (Time To Live) en millisecondes
  CACHE_TTL: {
    APPLICATIONS: 10 * 60 * 1000, // 10 minutes
    USERS: 5 * 60 * 1000, // 5 minutes
    USER_ACCESS: 5 * 60 * 1000, // 5 minutes
    EMAIL_TEMPLATES: 15 * 60 * 1000, // 15 minutes
    LOGS: 2 * 60 * 1000, // 2 minutes
    SMTP_CONFIG: 30 * 60 * 1000, // 30 minutes
  },

  // Intervalles de refetch automatique
  REFETCH_INTERVALS: {
    APPLICATIONS: 5 * 60 * 1000, // 5 minutes
    USERS: 3 * 60 * 1000, // 3 minutes
    USER_ACCESS: 2 * 60 * 1000, // 2 minutes
    EMAIL_TEMPLATES: 10 * 60 * 1000, // 10 minutes
    LOGS: 1 * 60 * 1000, // 1 minute
  },

  // Délais de préchargement
  PRELOAD_DELAYS: {
    CRITICAL_DATA: 1000, // 1 seconde
    IMAGES: 2000, // 2 secondes
    SECONDARY_DATA: 3000, // 3 secondes
  },

  // Limites de pagination
  PAGINATION: {
    LOGS_PER_PAGE: 50,
    USERS_PER_PAGE: 100,
    APPLICATIONS_PER_PAGE: 50,
  },

  // Timeouts pour les requêtes
  TIMEOUTS: {
    API_REQUEST: 10000, // 10 secondes
    EMAIL_SEND: 15000, // 15 secondes
    FILE_UPLOAD: 30000, // 30 secondes
  },

  // Configuration des images
  IMAGES: {
    PLACEHOLDER_SIZE: 64,
    MAX_SIZE: 1024,
    QUALITY: 85,
  },

  // Configuration du débounce pour la recherche
  DEBOUNCE: {
    SEARCH: 300, // 300ms
    FORM_SUBMIT: 500, // 500ms
  },
} as const

// Fonctions utilitaires pour la performance
export function getCacheKey(prefix: string, identifier?: string | number): string {
  return identifier ? `${prefix}_${identifier}` : prefix
}

export function shouldUseCache(dataType: keyof typeof PERFORMANCE_CONFIG.CACHE_TTL): boolean {
  // Désactiver le cache en mode développement pour faciliter le debug
  if (process.env.NODE_ENV === 'development') {
    return false
  }
  return true
}

export function getOptimalBatchSize(dataType: string): number {
  switch (dataType) {
    case 'logs':
      return PERFORMANCE_CONFIG.PAGINATION.LOGS_PER_PAGE
    case 'users':
      return PERFORMANCE_CONFIG.PAGINATION.USERS_PER_PAGE
    case 'applications':
      return PERFORMANCE_CONFIG.PAGINATION.APPLICATIONS_PER_PAGE
    default:
      return 50
  }
}

// Configuration pour le lazy loading
export const LAZY_LOADING_CONFIG = {
  // Composants à charger de manière différée
  COMPONENTS: {
    EMAIL_TEMPLATES: true,
    LOGS: true,
    USER_ACCESS_DETAILS: true,
  },

  // Images à précharger
  PRELOAD_IMAGES: [
    '/placeholder.svg?height=64&width=64&text=Gmail',
    '/placeholder.svg?height=64&width=64&text=Drive',
    '/placeholder.svg?height=64&width=64&text=Slack',
  ],
} as const 