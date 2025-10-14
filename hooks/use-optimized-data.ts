import { useState, useEffect, useCallback } from 'react'
import { getCachedApplications, getCachedUsers, getCachedUserAccess, getUserApplications, getAdminData } from '@/lib/optimized-data'

interface UseOptimizedDataOptions {
  enableCache?: boolean
  refetchInterval?: number
  onError?: (error: Error) => void
}

export function useOptimizedData<T>(
  dataFetcher: () => Promise<T>,
  options: UseOptimizedDataOptions = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await dataFetcher()
      setData(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur inconnue')
      setError(error)
      options.onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [dataFetcher, options.onError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Refetch automatique si configuré
  useEffect(() => {
    if (options.refetchInterval) {
      const interval = setInterval(fetchData, options.refetchInterval)
      return () => clearInterval(interval)
    }
  }, [fetchData, options.refetchInterval])

  return { data, loading, error, refetch: fetchData }
}

// Hooks spécialisés pour les données courantes
export function useApplications() {
  return useOptimizedData(() => Promise.resolve(getCachedApplications()), {
    refetchInterval: 5 * 60 * 1000 // 5 minutes
  })
}

export function useUsers() {
  return useOptimizedData(() => Promise.resolve(getCachedUsers()), {
    refetchInterval: 5 * 60 * 1000 // 5 minutes
  })
}

export function useUserAccess() {
  return useOptimizedData(() => Promise.resolve(getCachedUserAccess()), {
    refetchInterval: 5 * 60 * 1000 // 5 minutes
  })
}

export function useUserApplications(userId: number) {
  return useOptimizedData(
    () => Promise.resolve(getUserApplications(userId)),
    {
      refetchInterval: 2 * 60 * 1000 // 2 minutes
    }
  )
}

export function useAdminData() {
  return useOptimizedData(() => Promise.resolve(getAdminData()), {
    refetchInterval: 3 * 60 * 1000 // 3 minutes
  })
}

// Hook pour le chargement progressif
export function useProgressiveLoading<T>(
  dataFetcher: () => Promise<T>,
  fallbackData?: T
) {
  const [data, setData] = useState<T | null>(fallbackData || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        const result = await dataFetcher()
        if (mounted) {
          setData(result)
        }
      } catch (err) {
        if (mounted) {
          const error = err instanceof Error ? err : new Error('Erreur inconnue')
          setError(error)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [dataFetcher])

  return { data, loading, error }
} 