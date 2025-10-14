"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, User, Lock, Save } from "lucide-react"
import Link from "next/link"
import { PageLoader } from "@/components/loading-spinner"

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
}

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  const [formData, setFormData] = useState({
    nom: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })

  // Chargement des données utilisateur
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/check")
        if (response.ok) {
          const data = await response.json()
          if (data.isAuthenticated) {
            setUser(data.user)
            setFormData({
              nom: data.user.nom,
              email: data.user.email,
              currentPassword: "",
              newPassword: "",
              confirmPassword: ""
            })
          } else {
            router.push("/login")
          }
        } else {
          router.push("/login")
        }
      } catch (error) {
        console.error("Erreur lors du chargement:", error)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear messages when user starts typing
    if (error) setError("")
    if (success) setSuccess("")
  }

  const validateForm = () => {
    if (!formData.nom.trim()) {
      setError("Le nom est requis")
      return false
    }

    if (!formData.email.trim()) {
      setError("L'email est requis")
      return false
    }

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return false
    }

    if (formData.newPassword && formData.newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const updateData: any = {
        nom: formData.nom,
        email: formData.email
      }

      // Only include password fields if user wants to change password
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword
        updateData.newPassword = formData.newPassword
      }

      const res = await fetch(`/api/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess("Profil mis à jour avec succès")
        // Update user state
        setUser({ ...user!, nom: formData.nom, email: formData.email })
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        }))
      } else {
        setError(data.error || "Erreur lors de la mise à jour")
      }
    } catch (error) {
      setError("Erreur de connexion")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <header className="bg-white border-b border-[#dadde1] shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-[#1877f2]">SMT HUB</h1>
              <div className="hidden md:block">
                <span className="text-lg font-semibold text-[#1c1e21]">Mon Profil</span>
                <p className="text-sm text-[#65676b]">Gestion du compte</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <Link href="/">
                <Button className="bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21] font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#1877f2] to-[#166fe5] rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1c1e21]">Mon Profil</h1>
              <p className="text-[#65676b] text-lg">Gérez vos informations personnelles et votre mot de passe</p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1c1e21] mb-2">Informations du profil</h2>
            <p className="text-[#65676b]">Modifiez vos informations personnelles</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#1c1e21] flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations générales
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nom" className="text-[#1c1e21] font-medium">Nom complet</Label>
                  <Input
                    id="nom"
                    name="nom"
                    type="text"
                    value={formData.nom}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-[#1c1e21] font-medium">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 mt-1"
                    required
                  />
                </div>
              </div>

              <div className="bg-[#f0f2f5] p-4 rounded-lg border border-[#dadde1]">
                <p className="text-sm text-[#65676b]">
                  <strong className="text-[#1c1e21]">Rôle:</strong> {user?.role === "admin" ? "Administrateur" : "Utilisateur"}
                </p>
              </div>
            </div>

            {/* Password Change Section */}
            <div className="space-y-4 border-t border-[#dadde1] pt-6">
              <h3 className="text-lg font-semibold text-[#1c1e21] flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Changer le mot de passe
              </h3>
              <p className="text-sm text-[#65676b]">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>

              <div>
                <Label htmlFor="currentPassword" className="text-[#1c1e21] font-medium">Mot de passe actuel</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newPassword" className="text-[#1c1e21] font-medium">Nouveau mot de passe</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-[#1c1e21] font-medium">Confirmer le nouveau mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-medium px-6 py-2 rounded-md transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
