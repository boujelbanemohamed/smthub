import { cache } from './cache'
import { getApplications, getUsers, getUserAccess } from './shared-data'

// Clés de cache
const CACHE_KEYS = {
  APPLICATIONS: 'applications',
  USERS: 'users',
  USER_ACCESS: 'user_access',
  USER_APPLICATIONS: (userId: number) => `user_applications_${userId}`,
  ADMIN_DATA: 'admin_data'
} as const

// Fonctions optimisées avec cache
export function getCachedApplications() {
  const cached = cache.get(CACHE_KEYS.APPLICATIONS)
  if (cached) return cached

  const data = getApplications()
  cache.set(CACHE_KEYS.APPLICATIONS, data, 10 * 60 * 1000) // 10 minutes
  return data
}

export function getCachedUsers() {
  const cached = cache.get(CACHE_KEYS.USERS)
  if (cached) return cached

  const data = getUsers()
  cache.set(CACHE_KEYS.USERS, data, 10 * 60 * 1000) // 10 minutes
  return data
}

export function getCachedUserAccess() {
  const cached = cache.get(CACHE_KEYS.USER_ACCESS)
  if (cached) return cached

  const data = getUserAccess()
  cache.set(CACHE_KEYS.USER_ACCESS, data, 10 * 60 * 1000) // 10 minutes
  return data
}

export function getUserApplications(userId: number) {
  const cacheKey = CACHE_KEYS.USER_APPLICATIONS(userId)
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const applications = getCachedApplications()
  const userAccess = getCachedUserAccess()

  const userAppIds = userAccess
    .filter(access => access.utilisateur_id === userId)
    .map(access => access.application_id)

  const userApps = applications.filter(app => userAppIds.includes(app.id))
  cache.set(cacheKey, userApps, 5 * 60 * 1000) // 5 minutes
  return userApps
}

export function getAdminData() {
  const cached = cache.get(CACHE_KEYS.ADMIN_DATA)
  if (cached) return cached

  const users = getCachedUsers()
  const applications = getCachedApplications()
  const userAccess = getCachedUserAccess()

  const data = { users, applications, userAccess }
  cache.set(CACHE_KEYS.ADMIN_DATA, data, 5 * 60 * 1000) // 5 minutes
  return data
}

// Fonctions pour invalider le cache
export function invalidateCache(pattern?: string) {
  if (!pattern) {
    cache.clear()
    return
  }

  // Logique pour invalider des clés spécifiques
  if (pattern === 'users') {
    cache.delete(CACHE_KEYS.USERS)
    cache.delete(CACHE_KEYS.ADMIN_DATA)
  } else if (pattern === 'applications') {
    cache.delete(CACHE_KEYS.APPLICATIONS)
    cache.delete(CACHE_KEYS.ADMIN_DATA)
  } else if (pattern === 'user_access') {
    cache.delete(CACHE_KEYS.USER_ACCESS)
    cache.delete(CACHE_KEYS.ADMIN_DATA)
  }
}

// Fonction pour précharger les données critiques
export function preloadCriticalData() {
  try {
    getCachedApplications()
    getCachedUsers()
  } catch (error) {
    console.error('Erreur lors du préchargement:', error)
  }
} 