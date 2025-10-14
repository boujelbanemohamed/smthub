"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Lock, Save, Eye, EyeOff } from "lucide-react"

interface User {
  id: number
  nom: string
  email: string
  role: "admin" | "utilisateur"
}

interface ProfileFormProps {
  user: User
  onSuccess?: (updatedUser: User) => void
  onError?: (error: string) => void
}

interface FormData {
  nom: string
  email: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ProfileForm({ user, onSuccess, onError }: ProfileFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    nom: user.nom,
    email: user.email,
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })

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

  const validateForm = (): boolean => {
    if (!formData.nom.trim()) {
      const errorMsg = "Le nom est requis"
      setError(errorMsg)
      onError?.(errorMsg)
      return false
    }
    if (!formData.email.trim()) {
      const errorMsg = "L'email est requis"
      setError(errorMsg)
      onError?.(errorMsg)
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      const errorMsg = "Format d'email invalide"
      setError(errorMsg)
      onError?.(errorMsg)
      return false
    }
    
    // If user wants to change password
    if (formData.newPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        const errorMsg = "Le mot de passe actuel est requis pour changer le mot de passe"
        setError(errorMsg)
        onError?.(errorMsg)
        return false
      }
      if (formData.newPassword.length < 6) {
        const errorMsg = "Le nouveau mot de passe doit contenir au moins 6 caractères"
        setError(errorMsg)
        onError?.(errorMsg)
        return false
      }
      if (formData.newPassword !== formData.confirmPassword) {
        const errorMsg = "Les nouveaux mots de passe ne correspondent pas"
        setError(errorMsg)
        onError?.(errorMsg)
        return false
      }
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
        const successMsg = "Profil mis à jour avec succès"
        setSuccess(successMsg)
        
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        }))

        // Call success callback with updated user data
        onSuccess?.({
          ...user,
          nom: formData.nom,
          email: formData.email
        })
      } else {
        const errorMsg = data.error || "Erreur lors de la mise à jour"
        setError(errorMsg)
        onError?.(errorMsg)
      }
    } catch (error) {
      const errorMsg = "Erreur de connexion"
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="shadow-2xl bg-gradient-to-br from-white/95 to-blue-50/90 backdrop-blur-sm border-blue-200/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl text-blue-800">
          <User className="w-6 h-6" />
          Informations du profil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
              <User className="w-5 h-5" />
              Informations générales
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nom" className="text-blue-700">Nom complet</Label>
                <Input
                  id="nom"
                  name="nom"
                  type="text"
                  value={formData.nom}
                  onChange={handleInputChange}
                  className="mt-1"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email" className="text-blue-700">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Rôle:</strong> {user.role === "admin" ? "Administrateur" : "Utilisateur"}
              </p>
            </div>
          </div>

          {/* Password Change Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Changer le mot de passe
            </h3>
            <p className="text-sm text-blue-600">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>
            
            <div>
              <Label htmlFor="currentPassword" className="text-blue-700">Mot de passe actuel</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newPassword" className="text-blue-700">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="mt-1 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-1 h-8 w-8 px-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword" className="text-blue-700">Confirmer le nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="mt-1 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-1 h-8 w-8 px-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-6">
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4" />
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
