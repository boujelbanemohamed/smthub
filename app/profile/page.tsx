"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, User, Lock, Save, Camera, Upload, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { PageLoader } from "@/components/loading-spinner"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { UserAvatar } from "@/components/ui/user-avatar"

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
  avatar?: string | null
}

// Couleurs proposées pour un avatar « initiales ».
const AVATAR_COLORS = ["#1877f2", "#42b883", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"]

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
  const [avatar, setAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // Affichage/masquage des mots de passe (picto œil), par champ.
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false })
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Chargement des données utilisateur
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/check")
        if (response.ok) {
          const data = await response.json()
          if (data.isAuthenticated) {
            setUser(data.user)
            setAvatar(data.user.avatar ?? null)
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")
    setSuccess("")
    if (file.size > 2 * 1024 * 1024) {
      setError("Image trop volumineuse (max 2 Mo).")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        setAvatar(data.url)
      } else {
        setError(data.error || "Échec du téléversement de l'image.")
      }
    } catch {
      setError("Erreur lors du téléversement.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
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
        email: formData.email,
        avatar: avatar
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
        setUser({ ...user!, nom: formData.nom, email: formData.email, avatar })
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
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className="bg-surface border-b border-line shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <BrandLogo height={32} />
              <div className="hidden md:block">
                <span className="text-lg font-semibold text-ink">Mon Profil</span>
                <p className="text-sm text-ink-muted">Gestion du compte</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Link href="/">
                <Button className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
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
        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 mb-8">
          <div className="flex items-center space-x-4">
            <UserAvatar name={formData.nom || user?.nom || "?"} avatar={avatar} size={64} className="shadow-md" />
            <div>
              <h1 className="text-3xl font-bold text-ink">Mon Profil</h1>
              <p className="text-ink-muted text-lg">Gérez vos informations personnelles et votre mot de passe</p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-ink mb-2">Informations du profil</h2>
            <p className="text-ink-muted">Modifiez vos informations personnelles</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar / Photo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Photo de profil
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <UserAvatar name={formData.nom || "?"} avatar={avatar} size={96} className="shadow-md ring-2 ring-line" />

                <div className="flex-1 space-y-4 w-full">
                  {/* Téléverser une photo */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-brand hover:bg-brand-hover text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? "Téléversement..." : "Téléverser une photo"}
                    </Button>
                    {avatar && (
                      <Button
                        type="button"
                        onClick={() => setAvatar(null)}
                        className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm"
                      >
                        Retirer
                      </Button>
                    )}
                    <span className="text-xs text-ink-faint">PNG, JPG ou WEBP · max 2 Mo</span>
                  </div>

                  {/* Ou choisir une couleur d'initiales */}
                  <div>
                    <p className="text-sm text-ink-muted mb-2">Ou choisir un avatar coloré (vos initiales) :</p>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_COLORS.map((color) => {
                        const value = `color:${color}`
                        const selected = avatar === value
                        return (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Avatar couleur ${color}`}
                            onClick={() => setAvatar(value)}
                            className={`w-9 h-9 rounded-full transition-transform duration-150 hover:scale-110 ${selected ? "ring-2 ring-offset-2 ring-brand" : ""}`}
                            style={{ backgroundColor: color }}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4 border-t border-line pt-6">
              <h3 className="text-lg font-semibold text-ink flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations générales
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nom" className="text-ink font-medium">Nom complet</Label>
                  <Input
                    id="nom"
                    name="nom"
                    type="text"
                    value={formData.nom}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-ink font-medium">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 mt-1"
                    required
                  />
                </div>
              </div>

              <div className="bg-app p-4 rounded-lg border border-line">
                <p className="text-sm text-ink-muted">
                  <strong className="text-ink">Rôle:</strong> {user?.role === "admin" ? "Administrateur" : "Utilisateur"}
                </p>
              </div>
            </div>

            {/* Password Change Section */}
            <div className="space-y-4 border-t border-line pt-6">
              <h3 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Changer le mot de passe
              </h3>
              <p className="text-sm text-ink-muted">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>

              <div>
                <Label htmlFor="currentPassword" className="text-ink font-medium">Mot de passe actuel</Label>
                <div className="relative mt-1">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type={showPw.current ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 pr-10 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                  />
                  <button type="button" onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))}
                    aria-label={showPw.current ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors">
                    {showPw.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newPassword" className="text-ink font-medium">Nouveau mot de passe</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type={showPw.next ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 pr-10 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                    <button type="button" onClick={() => setShowPw((s) => ({ ...s, next: !s.next }))}
                      aria-label={showPw.next ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors">
                      {showPw.next ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-ink font-medium">Confirmer le nouveau mot de passe</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPw.confirm ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 pr-10 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                    <button type="button" onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                      aria-label={showPw.confirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors">
                      {showPw.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages (juste au-dessus du bouton pour être visibles) */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-brand hover:bg-brand-hover text-white font-medium px-6 py-2 rounded-md transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
