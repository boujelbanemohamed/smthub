"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })
  const router = useRouter()

  const checkAuth = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const res = await fetch("/api/auth/check", {
        credentials: "include"
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user) {
          setAuthState({
            user: data.user,
            loading: false,
            error: null
          })
          return data.user
        }
      }
      
      // Not authenticated
      setAuthState({
        user: null,
        loading: false,
        error: null
      })
      return null
    } catch (error) {
      setAuthState({
        user: null,
        loading: false,
        error: "Erreur de vérification d'authentification"
      })
      return null
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      })

      if (res.ok) {
        const data = await res.json()
        setAuthState({
          user: data.user,
          loading: false,
          error: null
        })
        return { success: true, user: data.user }
      } else {
        const errorData = await res.json()
        const errorMessage = errorData.error || "Erreur de connexion"
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      const errorMessage = "Erreur de connexion"
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      return { success: false, error: errorMessage }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      })
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
    } finally {
      setAuthState({
        user: null,
        loading: false,
        error: null
      })
      router.push("/login")
    }
  }, [router])

  const updateUser = useCallback((updatedUser: User) => {
    setAuthState(prev => ({
      ...prev,
      user: updatedUser
    }))
  }, [])

  const requireAuth = useCallback(() => {
    if (!authState.loading && !authState.user) {
      router.push("/login")
      return false
    }
    return true
  }, [authState.loading, authState.user, router])

  const requireAdmin = useCallback(() => {
    if (!requireAuth()) return false
    
    if (authState.user?.role !== "admin") {
      router.push("/")
      return false
    }
    return true
  }, [authState.user, requireAuth, router])

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return {
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    isAuthenticated: !!authState.user,
    isAdmin: authState.user?.role === "admin",
    login,
    logout,
    checkAuth,
    updateUser,
    requireAuth,
    requireAdmin
  }
}
