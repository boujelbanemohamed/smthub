"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, Settings, User } from "lucide-react"
import { PageLoader } from "@/components/loading-spinner"
import { AppAvatar } from "@/components/ui/app-avatar"

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
}

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Chargement des données utilisateur et applications
  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérifier l'authentification
        const authResponse = await fetch("/api/auth/check")
        if (!authResponse.ok) {
          router.push("/login")
          return
        }

        const authData = await authResponse.json()
        if (!authData.isAuthenticated) {
          router.push("/login")
          return
        }

        setUser(authData.user)

        // Charger les applications de l'utilisateur
        const appsResponse = await fetch("/api/user-applications")
        if (appsResponse.ok) {
          const appsData = await appsResponse.json()
          setApplications(appsData)
        }
      } catch (error) {
        console.error("Erreur lors du chargement:", error)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
    }
  }

  if (loading) {
    return <PageLoader />
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Facebook-style Header */}
      <header className="bg-white border-b border-[#dadde1] shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-[#1877f2]">SMT HUB</h1>
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#1877f2] rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="hidden md:block">
                  <p className="text-[#1c1e21] font-medium">{user.nom}</p>
                  <p className="text-[#65676b] text-sm">{user.email}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <Link href="/profile">
                  <Button className="bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21] font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                    <User className="w-4 h-4 mr-2" />
                    Profil
                  </Button>
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button className="bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21] font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Button
                  onClick={handleLogout}
                  className="bg-[#e41e3f] hover:bg-[#d01739] text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Applications Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#1c1e21]">Vos applications</h2>
            <span className="text-[#65676b] text-sm">
              {applications.length} application{applications.length > 1 ? 's' : ''} disponible{applications.length > 1 ? 's' : ''}
            </span>
          </div>

          {applications.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {applications.map((app, index) => (
                <Link
                  key={app.id}
                  href={app.app_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group fb-hover-lift"
                >
                  <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-4 text-center hover:shadow-lg transition-all duration-200">
                    <div className="flex justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                      <AppAvatar app={app} size={64} />
                    </div>
                    <h3 className="font-medium text-[#1c1e21] text-sm line-clamp-2 group-hover:text-[#1877f2] transition-colors duration-200">
                      {app.nom}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-12 text-center">
              <div className="w-16 h-16 bg-[#f0f2f5] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-xl font-semibold text-[#1c1e21] mb-2">Aucune application disponible</h3>
              <p className="text-[#65676b]">Contactez votre administrateur pour obtenir l'accès aux applications.</p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 text-center">
            <div className="w-12 h-12 bg-[#1877f2] rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-[#1c1e21] mb-2">Profil</h3>
            <p className="text-[#65676b] text-sm mb-4">Gérez vos informations personnelles</p>
            <Link href="/profile">
              <Button className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm w-full">
                Voir le profil
              </Button>
            </Link>
          </div>

          {user.role === "admin" && (
            <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 text-center">
              <div className="w-12 h-12 bg-[#42b883] rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-[#1c1e21] mb-2">Administration</h3>
              <p className="text-[#65676b] text-sm mb-4">Gérez les utilisateurs et applications</p>
              <Link href="/admin">
                <Button className="bg-[#42b883] hover:bg-[#369870] text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm w-full">
                  Accéder à l'admin
                </Button>
              </Link>
            </div>
          )}

          <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 text-center">
            <div className="w-12 h-12 bg-[#8a8d91] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-lg">{applications.length}</span>
            </div>
            <h3 className="font-semibold text-[#1c1e21] mb-2">Applications</h3>
            <p className="text-[#65676b] text-sm">Applications auxquelles vous avez accès</p>
          </div>
        </div>
      </main>
    </div>
  )
}
