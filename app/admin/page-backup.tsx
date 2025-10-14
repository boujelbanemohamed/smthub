"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Simulation de vérification d'authentification
    setTimeout(() => {
      setIsAuthenticated(true)
      setLoading(false)
    }, 1000)
  }, [])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <p className="text-gray-800 text-lg">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-blue-600">SMT HUB - Admin</h1>
            <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
              Déconnexion
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Panneau d'administration</h2>
          <p className="text-gray-600">Interface d'administration temporaire</p>
        </div>
      </main>
    </div>
  )
}
