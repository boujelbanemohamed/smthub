"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  Edit,
  Plus,
  Upload,
  Eye,
  User,
  Settings,
  ArrowLeft,
  LogOut,
  Search,
  Filter,
  Users,
  CheckSquare,
  Square,
  Mail,
  Send,
  FileText,
  Palette,
  Activity,
  RotateCcw,
  Save
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageLoader, SectionLoader } from "@/components/loading-spinner"

// Composant pour l'avatar d'application avec fallback
function AppAvatar({ app, size = 48 }: { app: Application, size?: number }) {
  const [imageError, setImageError] = useState(false)

  // Fonction pour générer une couleur basée sur le nom
  const getAvatarColor = (name: string) => {
    const colors = [
      '#1877f2', '#42b883', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // Fonction pour obtenir les initiales
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  if (!app.image_url || imageError) {
    const backgroundColor = (app as any).avatar_color || getAvatarColor(app.nom)
    const initials = getInitials(app.nom)

    return (
      <div
        className="flex items-center justify-center rounded-lg text-white font-bold"
        style={{
          width: size,
          height: size,
          backgroundColor,
          fontSize: size * 0.4
        }}
      >
        {initials}
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={app.image_url}
        alt={app.nom}
        fill
        className="object-contain rounded-lg"
        sizes={`${size}px`}
        onError={() => setImageError(true)}
      />
    </div>
  )
}

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
  avatar_color?: string
}

interface UserAccess {
  utilisateur_id: number
  application_id: number
}

export default function AdminPage() {
  const router = useRouter()

  // États principaux
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [userAccess, setUserAccess] = useState<UserAccess[]>([])

  // États des formulaires
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingApp, setEditingApp] = useState<Application | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // États des dialogs
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [appDialogOpen, setAppDialogOpen] = useState(false)
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false)
  const [editAppDialogOpen, setEditAppDialogOpen] = useState(false)

  // États de recherche et filtres
  const [searchUser, setSearchUser] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [accessFilter, setAccessFilter] = useState<"all" | "with_access" | "without_access">("all")
  const [bulkSelection, setBulkSelection] = useState<number[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)

  // États pour la configuration SMTP
  const [smtpConfig, setSmtpConfig] = useState({
    host: "smtp.gmail.com",
    port: "587",
    secure: false,
    user: "",
    password: "",
    from_name: "SMT HUB",
    from_email: ""
  })
  const [emailTemplates, setEmailTemplates] = useState({
    user_created: {
      subject: "Bienvenue sur SMT HUB - Votre compte est actif",
      enabled: true
    },
    user_updated: {
      subject: "Modification de votre profil SMT HUB",
      enabled: true
    },
    app_access_granted: {
      subject: "Nouvelle application disponible sur SMT HUB",
      enabled: true
    }
  })

  // États pour les templates d'emails modérables
  const [emailTemplateConfig, setEmailTemplateConfig] = useState<any>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState("")
  const [previewEmail, setPreviewEmail] = useState<any>(null)

  // États pour les logs
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsHasMore, setLogsHasMore] = useState(false)
  const [logsPage, setLogsPage] = useState(0)
  const [logFilters, setLogFilters] = useState({
    level: "",
    action: "",
    status: "",
    startDate: "",
    endDate: "",
    limit: 10
  })

  // Chargement initial des données avec optimisation
  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérification d'authentification en premier
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

        if (authData.user?.role !== "admin") {
          setIsAuthenticated(false)
          setLoading(false)
          return
        }

        setIsAuthenticated(true)

        // Chargement parallèle des données critiques
        const [usersRes, appsRes, accessRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/applications"),
          fetch("/api/admin/user-access")
        ])

        // Traitement des réponses en parallèle
        const [usersData, appsData, accessData] = await Promise.all([
          usersRes.ok ? usersRes.json() : [],
          appsRes.ok ? appsRes.json() : [],
          accessRes.ok ? accessRes.json() : []
        ])

        setUsers(usersData)
        setApplications(appsData)
        setUserAccess(accessData)

        // Chargement différé des données secondaires
        Promise.all([
          loadEmailTemplates(),
          loadLogs()
        ]).catch(error => {
          console.error("Erreur lors du chargement des données secondaires:", error)
        })

      } catch (error) {
        console.error("Erreur lors du chargement:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Recharger les logs quand les filtres changent
  useEffect(() => {
    if (isAuthenticated) {
      setLogsPage(0)
      loadLogs()
    }
  }, [logFilters])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  // Fonctions pour gérer l'ouverture des dialogs d'édition
  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditUserDialogOpen(true)
  }

  const handleEditApp = (app: Application) => {
    setEditingApp(app)
    setEditAppDialogOpen(true)
  }

  // Fonctions pour gérer la configuration SMTP
  const handleSaveSmtpConfig = async () => {
    try {
      const response = await fetch("/api/admin/smtp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpConfig)
      })

      if (response.ok) {
        alert("Configuration SMTP sauvegardée avec succès !")
      } else {
        alert("Erreur lors de la sauvegarde de la configuration SMTP")
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde SMTP:", error)
      alert("Erreur lors de la sauvegarde de la configuration SMTP")
    }
  }

  const handleTestSmtpConfig = async () => {
    try {
      const response = await fetch("/api/admin/smtp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpConfig)
      })

      if (response.ok) {
        alert("Email de test envoyé avec succès !")
      } else {
        alert("Erreur lors de l'envoi de l'email de test")
      }
    } catch (error) {
      console.error("Erreur lors du test SMTP:", error)
      alert("Erreur lors du test de la configuration SMTP")
    }
  }

  const handleSaveEmailTemplates = async () => {
    try {
      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailTemplates)
      })

      if (response.ok) {
        alert("Templates d'emails sauvegardés avec succès !")
      } else {
        alert("Erreur lors de la sauvegarde des templates")
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des templates:", error)
      alert("Erreur lors de la sauvegarde des templates d'emails")
    }
  }

  // Fonctions utilitaires
  const hasAccess = (userId: number, appId: number) => {
    return userAccess.some(access => access.utilisateur_id === userId && access.application_id === appId)
  }

  const getFilteredUsers = () => {
    return users
      .filter((user) => {
        const matchesSearch = user.nom.toLowerCase().includes(searchUser.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchUser.toLowerCase())

        if (!matchesSearch) return false

        if (accessFilter === "all") return true

        const userHasAnyAccess = applications.some(app => hasAccess(user.id, app.id))

        if (accessFilter === "with_access") return userHasAnyAccess
        if (accessFilter === "without_access") return !userHasAnyAccess

        return true
      })
  }

  // Gestion des utilisateurs
  const handleCreateUser = async (userData: Omit<User, "id">) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      })

      if (response.ok) {
        const newUser = await response.json()
        setUsers([...users, newUser])
        setUserDialogOpen(false)
      }
    } catch (error) {
      console.error("Erreur lors de la création:", error)
    }
  }

  const handleUpdateUser = async (userId: number, userData: Partial<User>) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUsers(users.map(user => user.id === userId ? updatedUser : user))
        setEditUserDialogOpen(false)
        setEditingUser(null)
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId))
        setUserAccess(userAccess.filter(access => access.utilisateur_id !== userId))
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
    }
  }

  // Gestion des applications
  const handleCreateApp = async (appData: Omit<Application, "id">) => {
    try {
      const response = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appData)
      })

      if (response.ok) {
        const newApp = await response.json()
        setApplications([...applications, newApp])
        setAppDialogOpen(false)
      }
    } catch (error) {
      console.error("Erreur lors de la création:", error)
    }
  }

  const handleUpdateApp = async (appId: number, appData: Partial<Application>) => {
    try {
      const response = await fetch(`/api/admin/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appData)
      })

      if (response.ok) {
        const updatedApp = await response.json()
        setApplications(applications.map(app => app.id === appId ? updatedApp : app))
        setEditAppDialogOpen(false)
        setEditingApp(null)
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
    }
  }

  const handleDeleteApp = async (appId: number) => {
    try {
      const response = await fetch(`/api/admin/applications/${appId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        setApplications(applications.filter(app => app.id !== appId))
        setUserAccess(userAccess.filter(access => access.application_id !== appId))
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
    }
  }

  // Gestion des accès
  const handleToggleAccess = async (userId: number, appId: number) => {
    const hasCurrentAccess = hasAccess(userId, appId)

    try {
      if (hasCurrentAccess) {
        const response = await fetch("/api/admin/user-access", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ utilisateur_id: userId, application_id: appId })
        })

        if (response.ok) {
          setUserAccess(userAccess.filter(access =>
            !(access.utilisateur_id === userId && access.application_id === appId)
          ))
        }
      } else {
        const response = await fetch("/api/admin/user-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ utilisateur_id: userId, application_id: appId })
        })

        if (response.ok) {
          setUserAccess([...userAccess, { utilisateur_id: userId, application_id: appId }])
        }
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des accès:", error)
    }
  }

  // Fonctions pour gérer les templates d'emails
  const loadEmailTemplates = async () => {
    try {
      const response = await fetch("/api/email-templates")
      if (response.ok) {
        const config = await response.json()
        setEmailTemplateConfig(config)
      }
    } catch (error) {
      console.error("Erreur lors du chargement des templates:", error)
    }
  }

  const handleUpdateTemplate = async (templateId: string, updates: any) => {
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateTemplate",
          data: { id: templateId, updates }
        })
      })

      if (response.ok) {
        await loadEmailTemplates()
        setTemplateDialogOpen(false)
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du template:", error)
    }
  }

  const handleUpdateSettings = async (settings: any) => {
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSettings",
          data: settings
        })
      })

      if (response.ok) {
        await loadEmailTemplates()
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour des paramètres:", error)
    }
  }

  const handleTestTemplate = async (templateId: string, testEmail: string) => {
    try {
      const response = await fetch("/api/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, testEmail })
      })

      if (response.ok) {
        const result = await response.json()
        setPreviewEmail(result.template)
        setTestEmailDialogOpen(true)
      }
    } catch (error) {
      console.error("Erreur lors du test du template:", error)
    }
  }

  const handleResetTemplates = async () => {
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resetTemplates"
        })
      })

      if (response.ok) {
        await loadEmailTemplates()
      }
    } catch (error) {
      console.error("Erreur lors de la réinitialisation des templates:", error)
    }
  }

  // Fonctions pour gérer les logs
  const loadLogs = async () => {
    try {
      setLogsLoading(true)
      const params = new URLSearchParams()
      if (logFilters.level) params.append("level", logFilters.level)
      if (logFilters.action) params.append("action", logFilters.action)
      if (logFilters.status) params.append("status", logFilters.status)
      if (logFilters.startDate) params.append("startDate", logFilters.startDate)
      if (logFilters.endDate) params.append("endDate", logFilters.endDate)
      params.append("limit", logFilters.limit.toString())
      params.append("offset", String(logsPage * logFilters.limit))

      const response = await fetch(`/api/admin/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        setLogsTotal(data.total || 0)
        setLogsHasMore(!!data.hasMore)
      }
    } catch (error) {
      console.error("Erreur lors du chargement des logs:", error)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleCleanLogs = async () => {
    if (confirm("Êtes-vous sûr de vouloir nettoyer les anciens logs ?")) {
      try {
        const response = await fetch("/api/admin/logs?daysToKeep=30", {
          method: "DELETE"
        })
        if (response.ok) {
          await loadLogs()
          alert("Logs nettoyés avec succès")
        }
      } catch (error) {
        console.error("Erreur lors du nettoyage des logs:", error)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#1877f2] border-t-transparent mx-auto mb-6"></div>
          <p className="text-[#1c1e21] text-lg">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold text-[#1c1e21] mb-2">Accès non autorisé</h2>
          <p className="text-[#65676b] mb-6">
            Vous devez être administrateur pour accéder à cette page.
          </p>
          <div className="flex space-x-4">
            <Link href="/">
              <Button className="bg-[#1877f2] hover:bg-[#166fe5] text-white">
                Retour à l'accueil
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21]">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
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
                <span className="text-lg font-semibold text-[#1c1e21]">Administration</span>
                <p className="text-sm text-[#65676b]">Panneau de contrôle</p>
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
              <Link href="/profile">
                <Button className="bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21] font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </Button>
              </Link>
              <Link href="/" target="_blank">
                <Button className="bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21] font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
              </Link>
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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#1877f2] to-[#166fe5] rounded-full flex items-center justify-center">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1c1e21]">Panneau d'administration</h1>
              <p className="text-[#65676b] text-lg">Gérez vos utilisateurs, applications et paramètres système</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#1877f2] rounded-full flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1c1e21]">{users.length}</p>
                  <p className="text-[#65676b] text-sm">Utilisateurs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#42b883] rounded-full flex items-center justify-center mr-4">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1c1e21]">{applications.length}</p>
                  <p className="text-[#65676b] text-sm">Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#f59e0b] rounded-full flex items-center justify-center mr-4">
                  <CheckSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1c1e21]">{userAccess.length}</p>
                  <p className="text-[#65676b] text-sm">Accès accordés</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#8a8d91] rounded-full flex items-center justify-center mr-4">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1c1e21]">
                    {users.filter(user => applications.some(app => hasAccess(user.id, app.id))).length}
                  </p>
                  <p className="text-[#65676b] text-sm">Utilisateurs actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
                      <TabsList className="grid w-full grid-cols-5 bg-white border border-[#dadde1] rounded-lg p-1">
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-[#1877f2] data-[state=active]:text-white text-[#1c1e21] font-medium"
              >
                <Users className="w-4 h-4 mr-2" />
                Utilisateurs
              </TabsTrigger>
              <TabsTrigger
                value="applications"
                className="data-[state=active]:bg-[#1877f2] data-[state=active]:text-white text-[#1c1e21] font-medium"
              >
                <Settings className="w-4 h-4 mr-2" />
                Applications
              </TabsTrigger>
              <TabsTrigger
                value="access"
                className="data-[state=active]:bg-[#1877f2] data-[state=active]:text-white text-[#1c1e21] font-medium"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Gestion des accès
              </TabsTrigger>
              <TabsTrigger
                value="emails"
                className="data-[state=active]:bg-[#1877f2] data-[state=active]:text-white text-[#1c1e21] font-medium"
              >
                <Mail className="w-4 h-4 mr-2" />
                Configuration Emails
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="data-[state=active]:bg-[#1877f2] data-[state=active]:text-white text-[#1c1e21] font-medium"
              >
                <Activity className="w-4 h-4 mr-2" />
                Logs
              </TabsTrigger>
            </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-[#1c1e21]">Gestion des utilisateurs</CardTitle>
                  <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#1877f2] hover:bg-[#166fe5] text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Nouvel utilisateur
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle className="text-[#1c1e21]">Créer un nouvel utilisateur</DialogTitle>
                      </DialogHeader>
                      <UserForm onSubmit={handleCreateUser} />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-[#dadde1] rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-[#1877f2] rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-[#1c1e21]">{user.nom}</p>
                          <p className="text-sm text-[#65676b]">{user.email}</p>
                        </div>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className={user.role === "admin" ? "bg-[#1877f2] text-white" : "bg-[#e4e6ea] text-[#1c1e21]"}
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-white">
                            <DialogHeader>
                              <DialogTitle className="text-[#1c1e21]">Modifier l'utilisateur</DialogTitle>
                            </DialogHeader>
                            <UserForm
                              user={editingUser}
                              onSubmit={(data) => editingUser && handleUpdateUser(editingUser.id, data)}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-[#1c1e21]">Gestion des applications</CardTitle>
                  <Dialog open={appDialogOpen} onOpenChange={setAppDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#1877f2] hover:bg-[#166fe5] text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Nouvelle application
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle className="text-[#1c1e21]">Créer une nouvelle application</DialogTitle>
                      </DialogHeader>
                      <ApplicationForm onSubmit={handleCreateApp} />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {applications.map((app) => (
                    <div key={app.id} className="border border-[#dadde1] rounded-lg p-4">
                      <div className="flex items-center space-x-4 mb-4">
                        <AppAvatar app={app} size={48} />
                        <div className="flex-1">
                          <h3 className="font-medium text-[#1c1e21]">{app.nom}</h3>
                          <p className="text-sm text-[#65676b]">Ordre: {app.ordre_affichage}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <a
                          href={app.app_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1877f2] hover:text-[#166fe5] text-sm"
                        >
                          Ouvrir l'app
                        </a>
                        <div className="flex items-center space-x-2">
                          <Dialog open={editAppDialogOpen} onOpenChange={setEditAppDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                                onClick={() => handleEditApp(app)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-white">
                              <DialogHeader>
                                <DialogTitle className="text-[#1c1e21]">Modifier l'application</DialogTitle>
                              </DialogHeader>
                              <ApplicationForm
                                application={editingApp}
                                onSubmit={(data) => editingApp && handleUpdateApp(editingApp.id, data)}
                              />
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteApp(app.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Management Tab */}
          <TabsContent value="access" className="space-y-6">
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-[#1c1e21]">Gestion des accès utilisateurs</CardTitle>
                <div className="flex items-center space-x-4 mt-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Rechercher un utilisateur..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <Select value={accessFilter} onValueChange={(value: any) => setAccessFilter(value)}>
                    <SelectTrigger className="w-48 border-[#dadde1]">
                      <SelectValue placeholder="Filtrer par accès" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#dadde1]">
                      <SelectItem value="all">Tous les utilisateurs</SelectItem>
                      <SelectItem value="with_access">Avec accès</SelectItem>
                      <SelectItem value="without_access">Sans accès</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getFilteredUsers().map((user) => (
                    <div key={user.id} className="border border-[#dadde1] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-[#1877f2] rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-[#1c1e21]">{user.nom}</p>
                            <p className="text-sm text-[#65676b]">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-sm text-[#65676b]">
                          {applications.filter(app => hasAccess(user.id, app.id)).length} / {applications.length} applications
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {applications.map((app) => (
                          <div key={app.id} className="flex items-center justify-between p-3 border border-[#dadde1] rounded-md">
                            <div className="flex items-center space-x-3">
                              <AppAvatar app={app} size={32} />
                              <span className="text-sm font-medium text-[#1c1e21]">{app.nom}</span>
                            </div>
                            <Checkbox
                              checked={hasAccess(user.id, app.id)}
                              onCheckedChange={() => handleToggleAccess(user.id, app.id)}
                              className="border-[#dadde1] data-[state=checked]:bg-[#1877f2] data-[state=checked]:border-[#1877f2]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

            {/* Configuration Emails Tab */}
            <TabsContent value="emails" className="space-y-6">
            {/* Configuration SMTP */}
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-[#1c1e21] flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  Configuration du serveur SMTP
                </CardTitle>
                <p className="text-[#65676b] text-sm">
                  Configurez les paramètres SMTP pour l'envoi automatique d'emails aux utilisateurs
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="smtp_host" className="text-[#1c1e21] font-medium">Serveur SMTP</Label>
                    <Input
                      id="smtp_host"
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_port" className="text-[#1c1e21] font-medium">Port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_user" className="text-[#1c1e21] font-medium">Nom d'utilisateur</Label>
                    <Input
                      id="smtp_user"
                      type="email"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      placeholder="votre-email@gmail.com"
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_password" className="text-[#1c1e21] font-medium">Mot de passe</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      value={smtpConfig.password}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                      placeholder="Mot de passe ou App Password"
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="from_name" className="text-[#1c1e21] font-medium">Nom de l'expéditeur</Label>
                    <Input
                      id="from_name"
                      type="text"
                      value={smtpConfig.from_name}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                      placeholder="SMT HUB"
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="from_email" className="text-[#1c1e21] font-medium">Email de l'expéditeur</Label>
                    <Input
                      id="from_email"
                      type="email"
                      value={smtpConfig.from_email}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                      placeholder="noreply@smt.com"
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="smtp_secure"
                    checked={smtpConfig.secure}
                    onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, secure: !!checked })}
                  />
                  <Label htmlFor="smtp_secure" className="text-[#1c1e21] text-sm">
                    Utiliser SSL/TLS (recommandé pour Gmail)
                  </Label>
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={handleSaveSmtpConfig}
                    className="bg-[#1877f2] hover:bg-[#166fe5] text-white"
                  >
                    Sauvegarder la configuration
                  </Button>
                  <Button
                    onClick={handleTestSmtpConfig}
                    variant="outline"
                    className="border-[#1877f2] text-[#1877f2] hover:bg-[#1877f2] hover:text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Tester la configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Templates d'emails */}
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-[#1c1e21] flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Templates d'emails automatiques
                </CardTitle>
                <p className="text-[#65676b] text-sm">
                  Configurez les emails automatiques envoyés aux utilisateurs lors de différents événements
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email de création de compte */}
                <div className="border border-[#dadde1] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-[#1c1e21]">Email de création de compte</h3>
                      <p className="text-sm text-[#65676b]">
                        Envoyé automatiquement lors de la création d'un nouvel utilisateur
                      </p>
                    </div>
                    <Checkbox
                      checked={emailTemplates.user_created.enabled}
                      onCheckedChange={(checked) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          user_created: { ...emailTemplates.user_created, enabled: !!checked }
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[#1c1e21] font-medium">Sujet de l'email</Label>
                    <Input
                      value={emailTemplates.user_created.subject}
                      onChange={(e) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          user_created: { ...emailTemplates.user_created, subject: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-[#f0f2f5] rounded-md">
                    <p className="text-sm text-[#65676b]">
                      <strong>Contenu de l'email :</strong> Bonjour [NOM], votre compte SMT HUB a été créé avec succès.
                      Vos identifiants de connexion sont : Email: [EMAIL], Mot de passe: [MOT_DE_PASSE].
                      Connectez-vous sur [URL] pour accéder à vos applications.
                    </p>
                  </div>
                </div>

                {/* Email de modification de profil */}
                <div className="border border-[#dadde1] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-[#1c1e21]">Email de modification de profil</h3>
                      <p className="text-sm text-[#65676b]">
                        Envoyé automatiquement lors de la modification d'un profil utilisateur
                      </p>
                    </div>
                    <Checkbox
                      checked={emailTemplates.user_updated.enabled}
                      onCheckedChange={(checked) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          user_updated: { ...emailTemplates.user_updated, enabled: !!checked }
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[#1c1e21] font-medium">Sujet de l'email</Label>
                    <Input
                      value={emailTemplates.user_updated.subject}
                      onChange={(e) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          user_updated: { ...emailTemplates.user_updated, subject: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-[#f0f2f5] rounded-md">
                    <p className="text-sm text-[#65676b]">
                      <strong>Contenu de l'email :</strong> Bonjour [NOM], votre profil SMT HUB a été modifié.
                      Modifications apportées : [MODIFICATIONS]. Si vous n'êtes pas à l'origine de ces modifications,
                      contactez votre administrateur.
                    </p>
                  </div>
                </div>

                {/* Email d'accès à une nouvelle application */}
                <div className="border border-[#dadde1] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-[#1c1e21]">Email d'accès à une nouvelle application</h3>
                      <p className="text-sm text-[#65676b]">
                        Envoyé automatiquement lorsqu'une nouvelle application est rendue accessible à un utilisateur
                      </p>
                    </div>
                    <Checkbox
                      checked={emailTemplates.app_access_granted.enabled}
                      onCheckedChange={(checked) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          app_access_granted: { ...emailTemplates.app_access_granted, enabled: !!checked }
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[#1c1e21] font-medium">Sujet de l'email</Label>
                    <Input
                      value={emailTemplates.app_access_granted.subject}
                      onChange={(e) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          app_access_granted: { ...emailTemplates.app_access_granted, subject: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-[#f0f2f5] rounded-md">
                    <p className="text-sm text-[#65676b]">
                      <strong>Contenu de l'email :</strong> Bonjour [NOM], une nouvelle application "[NOM_APPLICATION]"
                      est maintenant disponible dans votre SMT HUB. Connectez-vous sur [URL] pour y accéder.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveEmailTemplates}
                    className="bg-[#1877f2] hover:bg-[#166fe5] text-white"
                  >
                    Sauvegarder les templates
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Email Templates Section */}
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-[#1c1e21] flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Templates d'emails automatiques
                    </CardTitle>
                    <p className="text-[#65676b] text-sm">
                      Modifiez le contenu des emails automatiques envoyés aux utilisateurs
                    </p>
                  </div>
                  <Button
                    onClick={handleResetTemplates}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {emailTemplateConfig ? (
                  <div className="space-y-6">
                    {/* Sélection du template */}
                    <div>
                      <Label htmlFor="templateSelect" className="text-[#1c1e21] font-medium">Sélectionner un template</Label>
                      <Select
                        value={selectedTemplate}
                        onValueChange={(value) => {
                          setSelectedTemplate(value)
                          setTemplateDialogOpen(true)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir un template à modifier" />
                        </SelectTrigger>
                        <SelectContent>
                          {emailTemplateConfig.templates.map((template: any) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Liste des templates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {emailTemplateConfig.templates.map((template: any) => (
                        <div
                          key={template.id}
                          className="p-4 border border-[#dadde1] rounded-lg hover:bg-[#f0f2f5] cursor-pointer"
                          onClick={() => {
                            setSelectedTemplate(template.id)
                            setTemplateDialogOpen(true)
                          }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium text-[#1c1e21]">{template.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-[#65676b] mb-3">{template.description}</p>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTemplate(template.id)
                                setTemplateDialogOpen(true)
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Modifier
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTemplate(template.id)
                                setTestEmailDialogOpen(true)
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Tester
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1877f2] border-t-transparent mx-auto mb-4"></div>
                    <p className="text-[#65676b]">Chargement des templates...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Section */}
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-[#1c1e21] flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Paramètres généraux des templates
                </CardTitle>
                <p className="text-[#65676b] text-sm">
                  Configurez les paramètres globaux pour tous les templates d'emails
                </p>
              </CardHeader>
              <CardContent>
                {emailTemplateConfig ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName" className="text-[#1c1e21] font-medium">Nom de l'entreprise</Label>
                        <Input
                          id="companyName"
                          value={emailTemplateConfig.settings.companyName}
                          onChange={(e) => {
                            const newConfig = { ...emailTemplateConfig }
                            newConfig.settings.companyName = e.target.value
                            setEmailTemplateConfig(newConfig)
                          }}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label htmlFor="supportEmail" className="text-[#1c1e21] font-medium">Email de support</Label>
                        <Input
                          id="supportEmail"
                          value={emailTemplateConfig.settings.supportEmail}
                          onChange={(e) => {
                            const newConfig = { ...emailTemplateConfig }
                            newConfig.settings.supportEmail = e.target.value
                            setEmailTemplateConfig(newConfig)
                          }}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label htmlFor="websiteUrl" className="text-[#1c1e21] font-medium">URL du site web</Label>
                        <Input
                          id="websiteUrl"
                          value={emailTemplateConfig.settings.websiteUrl}
                          onChange={(e) => {
                            const newConfig = { ...emailTemplateConfig }
                            newConfig.settings.websiteUrl = e.target.value
                            setEmailTemplateConfig(newConfig)
                          }}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label htmlFor="logoUrl" className="text-[#1c1e21] font-medium">URL du logo</Label>
                        <Input
                          id="logoUrl"
                          value={emailTemplateConfig.settings.logoUrl}
                          onChange={(e) => {
                            const newConfig = { ...emailTemplateConfig }
                            newConfig.settings.logoUrl = e.target.value
                            setEmailTemplateConfig(newConfig)
                          }}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label htmlFor="primaryColor" className="text-[#1c1e21] font-medium">Couleur primaire</Label>
                        <Input
                          id="primaryColor"
                          type="color"
                          value={emailTemplateConfig.settings.primaryColor}
                          onChange={(e) => {
                            const newConfig = { ...emailTemplateConfig }
                            newConfig.settings.primaryColor = e.target.value
                            setEmailTemplateConfig(newConfig)
                          }}
                          className="w-full h-10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="secondaryColor" className="text-[#1c1e21] font-medium">Couleur secondaire</Label>
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={emailTemplateConfig.settings.secondaryColor}
                          onChange={(e) => {
                            const newConfig = { ...emailTemplateConfig }
                            newConfig.settings.secondaryColor = e.target.value
                            setEmailTemplateConfig(newConfig)
                          }}
                          className="w-full h-10"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleUpdateSettings}
                      className="bg-[#1877f2] hover:bg-[#166fe5] text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder les paramètres
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1877f2] border-t-transparent mx-auto mb-4"></div>
                    <p className="text-[#65676b]">Chargement des paramètres...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates d'emails Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-[#1c1e21] flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Templates d'emails automatiques
                    </CardTitle>
                    <p className="text-[#65676b] text-sm">
                      Modifiez le contenu des emails automatiques envoyés aux utilisateurs
                    </p>
                  </div>
                  <Button
                    onClick={handleResetTemplates}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Réinitialiser les templates
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {emailTemplateConfig && (
                  <div className="space-y-6">
                    {emailTemplateConfig.templates.map((template: any) => (
                      <div key={template.id} className="border border-[#dadde1] rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-[#1c1e21]">{template.name}</h3>
                            <p className="text-sm text-[#65676b]">{template.description}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => {
                                setSelectedTemplate(template.id)
                                setTemplateDialogOpen(true)
                              }}
                              variant="outline"
                              size="sm"
                              className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedTemplate(template.id)
                                setTestEmailAddress("")
                              }}
                              variant="outline"
                              size="sm"
                              className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Tester
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-[#1c1e21]">Sujet :</span>
                            <p className="text-[#65676b] mt-1">{template.subject}</p>
                          </div>
                          <div>
                            <span className="font-medium text-[#1c1e21]">Variables disponibles :</span>
                            <p className="text-[#65676b] mt-1">{template.variables.join(", ")}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Paramètres généraux Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-[#1c1e21] flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Paramètres généraux des templates
                </CardTitle>
                <p className="text-[#65676b] text-sm">
                  Configurez les paramètres globaux utilisés dans tous les templates d'emails
                </p>
              </CardHeader>
              <CardContent>
                {emailTemplateConfig && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="companyName" className="text-[#1c1e21] font-medium">Nom de l'entreprise</Label>
                      <Input
                        id="companyName"
                        value={emailTemplateConfig.settings.companyName}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.companyName = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supportEmail" className="text-[#1c1e21] font-medium">Email de support</Label>
                      <Input
                        id="supportEmail"
                        type="email"
                        value={emailTemplateConfig.settings.supportEmail}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.supportEmail = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="websiteUrl" className="text-[#1c1e21] font-medium">URL du site</Label>
                      <Input
                        id="websiteUrl"
                        value={emailTemplateConfig.settings.websiteUrl}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.websiteUrl = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="primaryColor" className="text-[#1c1e21] font-medium">Couleur primaire</Label>
                      <Input
                        id="primaryColor"
                        type="color"
                        value={emailTemplateConfig.settings.primaryColor}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.primaryColor = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full h-10 border border-[#dadde1] rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor" className="text-[#1c1e21] font-medium">Couleur secondaire</Label>
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={emailTemplateConfig.settings.secondaryColor}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.secondaryColor = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full h-10 border border-[#dadde1] rounded-md bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        onClick={() => handleUpdateSettings(emailTemplateConfig.settings)}
                        className="bg-[#1877f2] hover:bg-[#166fe5] text-white"
                      >
                        Sauvegarder les paramètres
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
                      </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="space-y-6">
              <Card className="bg-white border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-[#1c1e21] flex items-center">
                        <Activity className="w-5 h-5 mr-2" />
                        Journal d'activité
                      </CardTitle>
                      <p className="text-[#65676b] text-sm">
                        Consultez l'historique complet des actions administratives
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={loadLogs}
                        variant="outline"
                        className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Actualiser
                      </Button>
                      <Button
                        onClick={handleCleanLogs}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Nettoyer
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filtres */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                                         <div>
                       <Label htmlFor="logLevel" className="text-[#1c1e21] font-medium">Niveau</Label>
                       <Select
                         value={logFilters.level || "all"}
                         onValueChange={(value) => setLogFilters({ ...logFilters, level: value === "all" ? "" : value })}
                       >
                         <SelectTrigger className="w-full">
                           <SelectValue placeholder="Tous les niveaux" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="all">Tous les niveaux</SelectItem>
                           <SelectItem value="INFO">Information</SelectItem>
                           <SelectItem value="WARNING">Avertissement</SelectItem>
                           <SelectItem value="ERROR">Erreur</SelectItem>
                           <SelectItem value="SUCCESS">Succès</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div>
                       <Label htmlFor="logStartDate" className="text-[#1c1e21] font-medium">Du</Label>
                       <Input
                         id="logStartDate"
                         type="date"
                         value={logFilters.startDate}
                         onChange={(e) => setLogFilters({ ...logFilters, startDate: e.target.value })}
                         className="w-full"
                       />
                     </div>
                     <div>
                       <Label htmlFor="logEndDate" className="text-[#1c1e21] font-medium">Au</Label>
                       <Input
                         id="logEndDate"
                         type="date"
                         value={logFilters.endDate}
                         onChange={(e) => setLogFilters({ ...logFilters, endDate: e.target.value })}
                         className="w-full"
                       />
                     </div>
                     <div>
                       <Label htmlFor="logAction" className="text-[#1c1e21] font-medium">Action</Label>
                       <Input
                         id="logAction"
                         value={logFilters.action}
                         onChange={(e) => setLogFilters({ ...logFilters, action: e.target.value })}
                         placeholder="Filtrer par action..."
                         className="w-full"
                       />
                     </div>
                     <div>
                       <Label htmlFor="logStatus" className="text-[#1c1e21] font-medium">Statut</Label>
                       <Select
                         value={logFilters.status || "all"}
                         onValueChange={(value) => setLogFilters({ ...logFilters, status: value === "all" ? "" : value })}
                       >
                         <SelectTrigger className="w-full">
                           <SelectValue placeholder="Tous les statuts" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="all">Tous les statuts</SelectItem>
                           <SelectItem value="SUCCESS">Succès</SelectItem>
                           <SelectItem value="FAILED">Échec</SelectItem>
                           <SelectItem value="PENDING">En attente</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                    <div>
                      <Label htmlFor="logLimit" className="text-[#1c1e21] font-medium">Limite</Label>
                      <Select
                        value={logFilters.limit.toString()}
                        onValueChange={(value) => setLogFilters({ ...logFilters, limit: parseInt(value) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 entrées</SelectItem>
                          <SelectItem value="50">50 entrées</SelectItem>
                          <SelectItem value="100">100 entrées</SelectItem>
                          <SelectItem value="200">200 entrées</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Liste des logs */}
                  {logsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1877f2] border-t-transparent mx-auto mb-4"></div>
                      <p className="text-[#65676b]">Chargement des logs...</p>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-[#65676b]">Aucun log trouvé</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-4 rounded-lg border ${
                            log.level === "ERROR"
                              ? "bg-red-50 border-red-200"
                              : log.level === "WARNING"
                              ? "bg-yellow-50 border-yellow-200"
                              : log.level === "SUCCESS"
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                              <Badge
                                variant={
                                  log.level === "ERROR"
                                    ? "destructive"
                                    : log.level === "WARNING"
                                    ? "secondary"
                                    : log.level === "SUCCESS"
                                    ? "default"
                                    : "outline"
                                }
                                className="text-xs"
                              >
                                {log.level}
                              </Badge>
                              <Badge
                                variant={log.status === "SUCCESS" ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {log.status}
                              </Badge>
                              <span className="text-sm font-medium text-[#1c1e21]">
                                {log.action}
                              </span>
                            </div>
                            <span className="text-xs text-[#65676b]">
                              {new Date(log.timestamp).toLocaleString("fr-FR")}
                            </span>
                          </div>
                          <p className="text-sm text-[#65676b] mb-2">{log.details}</p>
                          {log.userName && (
                            <p className="text-xs text-[#65676b]">
                              <strong>Utilisateur :</strong> {log.userName}
                            </p>
                          )}
                          {log.errorMessage && (
                            <p className="text-xs text-red-600 mt-1">
                              <strong>Erreur :</strong> {log.errorMessage}
                            </p>
                          )}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 text-xs text-[#65676b]">
                              <strong>Métadonnées :</strong>
                              <pre className="mt-1 bg-white p-2 rounded border text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Pagination */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-[#65676b]">
                      Page {logsPage + 1} • {logsTotal} entrées
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                        disabled={logsPage === 0 || logsLoading}
                        onClick={() => {
                          const next = Math.max(0, logsPage - 1)
                          setLogsPage(next)
                          // recharger
                          loadLogs()
                        }}
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]"
                        disabled={!logsHasMore || logsLoading}
                        onClick={() => {
                          const next = logsPage + 1
                          setLogsPage(next)
                          loadLogs()
                        }}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

      {/* Dialog pour éditer un template */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1c1e21]">
              Modifier le template : {emailTemplateConfig?.templates.find((t: any) => t.id === selectedTemplate)?.name}
            </DialogTitle>
          </DialogHeader>
          {emailTemplateConfig && selectedTemplate && (
            <TemplateEditForm
              template={emailTemplateConfig.templates.find((t: any) => t.id === selectedTemplate)}
              onSubmit={(updates) => handleUpdateTemplate(selectedTemplate, updates)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog pour tester un template */}
      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1c1e21]">
              Tester le template : {emailTemplateConfig?.templates.find((t: any) => t.id === selectedTemplate)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testEmail" className="text-[#1c1e21] font-medium">Email de test</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
              />
            </div>
            <Button
              onClick={() => handleTestTemplate(selectedTemplate, testEmailAddress)}
              className="bg-[#1877f2] hover:bg-[#166fe5] text-white"
            >
              Générer l'aperçu
            </Button>
            {previewEmail && (
              <div className="border border-[#dadde1] rounded-lg p-4">
                <h4 className="font-semibold text-[#1c1e21] mb-2">Aperçu de l'email :</h4>
                <div className="mb-4">
                  <span className="font-medium text-[#1c1e21]">Sujet :</span>
                  <p className="text-[#65676b] mt-1">{previewEmail.subject}</p>
                </div>
                <div className="border border-[#dadde1] rounded-lg p-4 bg-gray-50">
                  <div dangerouslySetInnerHTML={{ __html: previewEmail.html }} />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Composant de formulaire pour les utilisateurs
function UserForm({ user, onSubmit }: { user?: User | null, onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    nom: user?.nom || "",
    email: user?.email || "",
    role: user?.role || "utilisateur",
    mot_de_passe: ""
  })

  // Mettre à jour le formulaire quand l'utilisateur change
  useEffect(() => {
    if (user) {
      setFormData({
        nom: user.nom || "",
        email: user.email || "",
        role: user.role || "utilisateur",
        mot_de_passe: "" // Ne pas pré-remplir le mot de passe pour la sécurité
      })
    } else {
      setFormData({ nom: "", email: "", role: "utilisateur", mot_de_passe: "" })
    }
  }, [user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Pour la modification, ne pas envoyer le mot de passe s'il est vide
    const dataToSubmit = user && !formData.mot_de_passe
      ? { nom: formData.nom, email: formData.email, role: formData.role }
      : formData
    onSubmit(dataToSubmit)
    if (!user) {
      setFormData({ nom: "", email: "", role: "utilisateur", mot_de_passe: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nom" className="text-[#1c1e21] font-medium">Nom</Label>
        <Input
          id="nom"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="text-[#1c1e21] font-medium">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="mot_de_passe" className="text-[#1c1e21] font-medium">
          Mot de passe
          {user ? (
            <span className="text-[#65676b] font-normal text-sm ml-1">(laisser vide pour ne pas modifier)</span>
          ) : (
            <span className="text-red-500 text-sm ml-1">*</span>
          )}
        </Label>
        <Input
          id="mot_de_passe"
          type="password"
          value={formData.mot_de_passe}
          onChange={(e) => setFormData({ ...formData, mot_de_passe: e.target.value })}
          placeholder={user ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required={!user}
        />
      </div>
      <div>
        <Label htmlFor="role" className="text-[#1c1e21] font-medium">Rôle</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger className="border-[#dadde1]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border border-[#dadde1]">
            <SelectItem value="utilisateur">Utilisateur</SelectItem>
            <SelectItem value="admin">Administrateur</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white">
        {user ? "Mettre à jour" : "Créer"}
      </Button>
    </form>
  )
}

// Composant de formulaire pour les applications
function ApplicationForm({ application, onSubmit }: { application?: Application | null, onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    nom: application?.nom || "",
    app_url: application?.app_url || "",
    image_url: application?.image_url || "",
    ordre_affichage: application?.ordre_affichage || 1,
    avatar_color: application?.avatar_color || "#1877f2"
  })

  // Mettre à jour le formulaire quand l'application change
  useEffect(() => {
    if (application) {
      setFormData({
        nom: application.nom || "",
        app_url: application.app_url || "",
        image_url: application.image_url || "",
        ordre_affichage: application.ordre_affichage || 1,
        avatar_color: application.avatar_color || "#1877f2"
      })
    } else {
      setFormData({ nom: "", app_url: "", image_url: "", ordre_affichage: 1, avatar_color: "#1877f2" })
    }
  }, [application])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    if (!application) {
      setFormData({ nom: "", app_url: "", image_url: "", ordre_affichage: 1 })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nom" className="text-[#1c1e21] font-medium">Nom de l'application</Label>
        <Input
          id="nom"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="avatar_color" className="text-[#1c1e21] font-medium">Couleur de fond de l'avatar</Label>
        <div className="flex items-center space-x-3">
          <Input
            id="avatar_color"
            type="color"
            value={formData.avatar_color}
            onChange={(e) => setFormData({ ...formData, avatar_color: e.target.value })}
            className="w-16 h-10 p-1 border border-[#dadde1] rounded-md bg-white"
          />
          <span className="text-sm text-[#65676b]">{formData.avatar_color}</span>
        </div>
      </div>
      <div>
        <Label htmlFor="app_url" className="text-[#1c1e21] font-medium">URL de l'application</Label>
        <Input
          id="app_url"
          type="url"
          value={formData.app_url}
          onChange={(e) => setFormData({ ...formData, app_url: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="image_url" className="text-[#1c1e21] font-medium">
          URL de l'image
          <span className="text-[#65676b] font-normal text-sm ml-1">(optionnel - avatar avec initiales si vide)</span>
        </Label>
        <Input
          id="image_url"
          type="url"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          placeholder="https://exemple.com/image.png"
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
        />
      </div>
      <div>
        <Label htmlFor="ordre_affichage" className="text-[#1c1e21] font-medium">Ordre d'affichage</Label>
        <Input
          id="ordre_affichage"
          type="number"
          min="1"
          value={formData.ordre_affichage}
          onChange={(e) => setFormData({ ...formData, ordre_affichage: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
      </div>
      <Button type="submit" className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white">
        {application ? "Mettre à jour" : "Créer"}
      </Button>
    </form>
  )
}

// Composant pour éditer un template d'email
function TemplateEditForm({ template, onSubmit }: { template: any, onSubmit: (updates: any) => void }) {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    subject: template?.subject || "",
    html: template?.html || "",
    text: template?.text || "",
    description: template?.description || ""
  })

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || "",
        subject: template.subject || "",
        html: template.html || "",
        text: template.text || "",
        description: template.description || ""
      })
    }
  }, [template])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="templateName" className="text-[#1c1e21] font-medium">Nom du template</Label>
        <Input
          id="templateName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
      </div>

      <div>
        <Label htmlFor="templateSubject" className="text-[#1c1e21] font-medium">Sujet de l'email</Label>
        <Input
          id="templateSubject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
          required
        />
                  <p className="text-xs text-[#65676b] mt-1">
            Utilisez {'{{variable}}'} pour insérer des variables dynamiques
          </p>
      </div>

      <div>
        <Label htmlFor="templateDescription" className="text-[#1c1e21] font-medium">Description</Label>
        <Input
          id="templateDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200"
        />
      </div>

      <div>
        <Label htmlFor="templateHtml" className="text-[#1c1e21] font-medium">Contenu HTML</Label>
        <textarea
          id="templateHtml"
          value={formData.html}
          onChange={(e) => setFormData({ ...formData, html: e.target.value })}
          rows={15}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 font-mono text-sm"
          required
        />
                    <p className="text-xs text-[#65676b] mt-1">
              HTML avec styles inline. Utilisez {'{{variable}}'} pour les variables dynamiques.
            </p>
      </div>

      <div>
        <Label htmlFor="templateText" className="text-[#1c1e21] font-medium">Version texte</Label>
        <textarea
          id="templateText"
          value={formData.text}
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
          rows={10}
          className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 font-mono text-sm"
          required
        />
        <p className="text-xs text-[#65676b] mt-1">
          Version texte simple pour les clients email qui ne supportent pas HTML.
        </p>
      </div>

      <div className="flex space-x-4">
        <Button type="submit" className="bg-[#1877f2] hover:bg-[#166fe5] text-white">
          Sauvegarder les modifications
        </Button>
        <Button type="button" variant="outline" className="border-[#dadde1] text-[#1c1e21] hover:bg-[#f0f2f5]">
          Annuler
        </Button>
      </div>
    </form>
  )
}
