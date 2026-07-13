"use client"

import React, { useState, useEffect, useRef } from "react"
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
  Save,
  ChevronUp,
  ChevronDown,
  Download,
  Layers,
  Megaphone,
  BarChart3,
  X,
  Home
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageLoader, SectionLoader } from "@/components/loading-spinner"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserAvatar } from "@/components/ui/user-avatar"
import { BrandLogo } from "@/components/brand-logo"

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
  avatar?: string | null
}

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
  avatar_color?: string
  category?: string
}

interface UserAccess {
  utilisateur_id: number
  application_id: number
}

interface Category {
  id: string
  name: string
}

export default function AdminPage() {
  const router = useRouter()

  // États principaux
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [userAccess, setUserAccess] = useState<UserAccess[]>([])

  // Catégories d'applications (modérables : ajout / renommage / suppression)
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState("")
  const [categoryError, setCategoryError] = useState("")

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
    userId: "",
    startDate: "",
    endDate: "",
    limit: 10
  })
  // Sélection de lignes pour suppression ciblée
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([])

  // Onglet actif (contrôlé, pour permettre l'ouverture directe via ?activity=<id>)
  const [activeTab, setActiveTab] = useState("users")
  const [activityUserId, setActivityUserId] = useState("")
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const act = params.get("activity")
    if (act) {
      setActivityUserId(act)
      setActiveTab("activity")
    }
  }, [])

  // Modifie un filtre et revient à la première page
  const updateLogFilter = (patch: Partial<typeof logFilters>) => {
    setSelectedLogIds([])
    setLogsPage(0)
    setLogFilters((prev) => ({ ...prev, ...patch }))
  }

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
          loadLogs(),
          loadCategories()
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

  // Recharger les logs quand les filtres OU la page changent
  useEffect(() => {
    if (isAuthenticated) {
      loadLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilters, logsPage])

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

  // Réordonner une application (flèches ↑/↓). Normalise l'ordre en 1..N et
  // persiste uniquement les applications dont l'ordre a changé.
  const [reordering, setReordering] = useState(false)
  const handleMoveApp = async (appId: number, direction: "up" | "down") => {
    if (reordering) return
    const sorted = [...applications].sort((a, b) => a.ordre_affichage - b.ordre_affichage)
    const idx = sorted.findIndex((a) => a.id === appId)
    const target = direction === "up" ? idx - 1 : idx + 1
    if (idx === -1 || target < 0 || target >= sorted.length) return

    // Échange des positions dans le tableau trié
    ;[sorted[idx], sorted[target]] = [sorted[target], sorted[idx]]
    // Réattribution propre 1..N
    const renumbered = sorted.map((app, i) => ({ ...app, ordre_affichage: i + 1 }))

    // Mise à jour optimiste de l'affichage
    setApplications(renumbered)
    setReordering(true)
    try {
      // Une seule requête en lot -> pas de race d'écriture sur le fichier.
      await fetch(`/api/admin/applications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: renumbered.map((app) => ({ id: app.id, ordre_affichage: app.ordre_affichage })),
        }),
      })
    } catch (error) {
      console.error("Erreur lors du réordonnancement:", error)
    } finally {
      setReordering(false)
    }
  }

  // Import / Export CSV
  const usersImportRef = useRef<HTMLInputElement>(null)
  const appsImportRef = useRef<HTMLInputElement>(null)

  // Recherche dans la liste des utilisateurs (admin)
  const [userSearch, setUserSearch] = useState("")
  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return true
    return u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  const refreshUsers = async () => {
    const res = await fetch("/api/admin/users")
    if (res.ok) setUsers(await res.json())
  }
  const refreshApps = async () => {
    const res = await fetch("/api/admin/applications")
    if (res.ok) setApplications(await res.json())
  }

  // --- Gestion des catégories (modération) ---
  const loadCategories = async () => {
    const res = await fetch("/api/admin/categories")
    if (res.ok) setCategories(await res.json())
  }

  const handleAddCategory = async () => {
    setCategoryError("")
    const name = newCategory.trim()
    if (!name) return
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setNewCategory("")
      await loadCategories()
    } else {
      const data = await res.json().catch(() => ({}))
      setCategoryError(data.error || "Erreur lors de l'ajout")
    }
  }

  const handleRenameCategory = async (id: string) => {
    setCategoryError("")
    const name = editingCatName.trim()
    if (!name) return
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setEditingCatId(null)
      setEditingCatName("")
      // Le renommage se répercute sur les applications → on recharge les deux.
      await Promise.all([loadCategories(), refreshApps()])
    } else {
      const data = await res.json().catch(() => ({}))
      setCategoryError(data.error || "Erreur lors du renommage")
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Supprimer la catégorie « ${cat.name} » ? Les applications qui la portent repasseront « sans catégorie ».`)) return
    setCategoryError("")
    const res = await fetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" })
    if (res.ok) {
      await Promise.all([loadCategories(), refreshApps()])
    } else {
      const data = await res.json().catch(() => ({}))
      setCategoryError(data.error || "Erreur lors de la suppression")
    }
  }

  const handleImportCsv = async (
    e: React.ChangeEvent<HTMLInputElement>,
    endpoint: string,
    refresh: () => Promise<void>,
    labelSingular: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json()
      if (res.ok) {
        let msg = `${data.created} ${labelSingular}(s) importé(s).`
        if (data.errors?.length) msg += `\n\n${data.errors.length} ligne(s) ignorée(s) :\n` + data.errors.slice(0, 15).join("\n")
        alert(msg)
        await refresh()
      } else {
        alert(data.error || "Erreur lors de l'import.")
      }
    } catch {
      alert("Impossible de lire le fichier.")
    } finally {
      if (e.target) e.target.value = ""
    }
  }

  // Télécharge un modèle CSV (en-tête + une ligne d'exemple) pour guider l'import
  const downloadCsvTemplate = (filename: string, header: string, example: string) => {
    const blob = new Blob(["﻿" + header + "\n" + example + "\n"], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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
      if (logFilters.userId) params.append("userId", logFilters.userId)
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

  // Suppression des lignes sélectionnées
  const handleDeleteSelectedLogs = async () => {
    if (selectedLogIds.length === 0) return
    if (!confirm(`Supprimer ${selectedLogIds.length} ligne(s) du journal ?`)) return
    try {
      const res = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedLogIds }),
      })
      if (res.ok) { setSelectedLogIds([]); await loadLogs() }
    } catch (error) {
      console.error("Erreur lors de la suppression des logs:", error)
    }
  }

  // Suppression de l'intégralité du journal
  const handleClearAllLogs = async () => {
    if (!confirm("Vider l'intégralité du journal ? Cette action est irréversible.")) return
    try {
      const res = await fetch("/api/admin/logs?all=1", { method: "DELETE" })
      if (res.ok) { setSelectedLogIds([]); setLogsPage(0); await loadLogs() }
    } catch (error) {
      console.error("Erreur lors de la purge des logs:", error)
    }
  }

  const toggleLogSelection = (id: string) => {
    setSelectedLogIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  const allPageSelected = logs.length > 0 && logs.every((l) => selectedLogIds.includes(l.id))
  const toggleSelectAllPage = () => {
    setSelectedLogIds((prev) => {
      const pageIds = logs.map((l) => l.id)
      return allPageSelected ? prev.filter((x) => !pageIds.includes(x)) : Array.from(new Set([...prev, ...pageIds]))
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand border-t-transparent mx-auto mb-6"></div>
          <p className="text-ink text-lg">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Accès non autorisé</h2>
          <p className="text-ink-muted mb-6">
            Vous devez être administrateur pour accéder à cette page.
          </p>
          <div className="flex space-x-4">
            <Link href="/">
              <Button className="bg-brand hover:bg-brand-hover text-white">
                Retour à l'accueil
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-surface-muted hover:bg-surface-muted text-ink">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
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
                <span className="text-lg font-semibold text-ink">Administration</span>
                <p className="text-sm text-ink-muted">Panneau de contrôle</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Link href="/">
                <Button className="bg-brand hover:bg-brand-hover text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                  <Home className="w-4 h-4 mr-2" />
                  Accueil
                </Button>
              </Link>
              <Link href="/profile">
                <Button className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </Button>
              </Link>
              <Link href="/" target="_blank">
                <Button className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
              </Link>
              <Button
                onClick={handleLogout}
                className="bg-danger hover:bg-danger-hover text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm"
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
        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-brand to-brand-hover rounded-full flex items-center justify-center">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-ink">Panneau d'administration</h1>
              <p className="text-ink-muted text-lg">Gérez vos utilisateurs, applications et paramètres système</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-brand rounded-full flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{users.length}</p>
                  <p className="text-ink-muted text-sm">Utilisateurs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center mr-4">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{applications.length}</p>
                  <p className="text-ink-muted text-sm">Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#f59e0b] rounded-full flex items-center justify-center mr-4">
                  <CheckSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{userAccess.length}</p>
                  <p className="text-ink-muted text-sm">Accès accordés</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-ink-faint rounded-full flex items-center justify-center mr-4">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">
                    {users.filter(user => applications.some(app => hasAccess(user.id, app.id))).length}
                  </p>
                  <p className="text-ink-muted text-sm">Utilisateurs actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                      <TabsList className="flex flex-wrap justify-center h-auto w-full gap-1 bg-surface border border-line rounded-lg p-1">
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Users className="w-4 h-4 mr-2" />
                Utilisateurs
              </TabsTrigger>
              <TabsTrigger
                value="applications"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Settings className="w-4 h-4 mr-2" />
                Applications
              </TabsTrigger>
              <TabsTrigger
                value="access"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Gestion des accès
              </TabsTrigger>
              <TabsTrigger
                value="emails"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Mail className="w-4 h-4 mr-2" />
                Configuration Emails
              </TabsTrigger>
              <TabsTrigger
                value="groups"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Layers className="w-4 h-4 mr-2" />
                Groupes
              </TabsTrigger>
              <TabsTrigger
                value="announcements"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Megaphone className="w-4 h-4 mr-2" />
                Annonces
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Statistiques
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <User className="w-4 h-4 mr-2" />
                Activité
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Activity className="w-4 h-4 mr-2" />
                Logs
              </TabsTrigger>
              <TabsTrigger
                value="backups"
                className="data-[state=active]:bg-brand data-[state=active]:text-white text-ink font-medium"
              >
                <Save className="w-4 h-4 mr-2" />
                Sauvegardes
              </TabsTrigger>
            </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <CardTitle className="text-ink">Gestion des utilisateurs</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={usersImportRef} type="file" accept=".csv,text/csv" className="hidden"
                      onChange={(e) => handleImportCsv(e, "/api/admin/users/import", refreshUsers, "utilisateur")} />
                    <Button variant="ghost" className="text-ink-muted hover:bg-app"
                      onClick={() => downloadCsvTemplate("modele-utilisateurs.csv", "nom,email,role,mot_de_passe", "Jean Dupont,jean.dupont@exemple.com,utilisateur,")}>
                      <Download className="w-4 h-4 mr-2" /> Modèle
                    </Button>
                    <Button variant="outline" className="border-line text-ink hover:bg-app"
                      onClick={() => usersImportRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Importer CSV
                    </Button>
                    <Button variant="outline" className="border-line text-ink hover:bg-app"
                      onClick={() => { window.location.href = "/api/admin/users/export" }}>
                      <Download className="w-4 h-4 mr-2" /> Exporter CSV
                    </Button>
                    <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-brand hover:bg-brand-hover text-white">
                          <Plus className="w-4 h-4 mr-2" />
                          Nouvel utilisateur
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-surface">
                        <DialogHeader>
                          <DialogTitle className="text-ink">Créer un nouvel utilisateur</DialogTitle>
                        </DialogHeader>
                        <UserForm onSubmit={handleCreateUser} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Rechercher (nom, email, rôle)…"
                    className="pl-9 bg-surface border-line text-ink"
                  />
                </div>
                <div className="space-y-4">
                  {filteredUsers.length === 0 && (
                    <p className="text-ink-muted text-sm">Aucun utilisateur ne correspond à « {userSearch} ».</p>
                  )}
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-line rounded-lg">
                      <div className="flex items-center space-x-4">
                        <UserAvatar name={user.nom} avatar={user.avatar} size={40} />
                        <div>
                          <p className="font-medium text-ink">{user.nom}</p>
                          <p className="text-sm text-ink-muted">{user.email}</p>
                        </div>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className={user.role === "admin" ? "bg-brand text-white" : "bg-surface-muted text-ink"}
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
                              className="border-line text-ink hover:bg-app"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-surface">
                            <DialogHeader>
                              <DialogTitle className="text-ink">Modifier l'utilisateur</DialogTitle>
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
            {/* Modération des catégories : ajout / renommage / suppression */}
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-ink">Catégories d'applications</CardTitle>
                <p className="text-sm text-ink-muted">
                  Gérez la liste des catégories (ex. Ressources Humaines, Production…). Elles sont proposées
                  lors de la création/modification d'une application et s'affichent sur sa carte.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory() } }}
                    placeholder="Nouvelle catégorie…"
                    className="max-w-xs bg-surface border-line text-ink"
                  />
                  <Button onClick={handleAddCategory} className="bg-brand hover:bg-brand-hover text-white">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter
                  </Button>
                </div>
                {categoryError ? <p className="text-sm text-red-600">{categoryError}</p> : null}
                {categories.length === 0 ? (
                  <p className="text-sm text-ink-muted">Aucune catégorie pour l'instant.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <li key={cat.id} className="flex items-center gap-1 rounded-full border border-line bg-app px-3 py-1">
                        {editingCatId === cat.id ? (
                          <>
                            <Input
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); handleRenameCategory(cat.id) }
                                if (e.key === "Escape") { setEditingCatId(null); setEditingCatName("") }
                              }}
                              autoFocus
                              className="h-7 w-40 bg-surface border-line text-ink text-sm"
                            />
                            <button type="button" title="Enregistrer" onClick={() => handleRenameCategory(cat.id)}
                              className="text-green-600 hover:text-green-700 text-sm font-medium px-1">OK</button>
                            <button type="button" title="Annuler" onClick={() => { setEditingCatId(null); setEditingCatName("") }}
                              className="text-ink-muted hover:text-ink px-1"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-ink">{cat.name}</span>
                            <button type="button" title="Renommer"
                              onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); setCategoryError("") }}
                              className="text-ink-muted hover:text-brand px-1"><Edit className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Supprimer" onClick={() => handleDeleteCategory(cat)}
                              className="text-ink-muted hover:text-red-600 px-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <CardTitle className="text-ink">Gestion des applications</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={appsImportRef} type="file" accept=".csv,text/csv" className="hidden"
                      onChange={(e) => handleImportCsv(e, "/api/admin/applications/import", refreshApps, "application")} />
                    <Button variant="ghost" className="text-ink-muted hover:bg-app"
                      onClick={() => downloadCsvTemplate("modele-applications.csv", "nom,app_url,image_url,ordre_affichage,category", "Mon Application,https://mon-app.com,https://mon-app.com/logo.png,1,Outils")}>
                      <Download className="w-4 h-4 mr-2" /> Modèle
                    </Button>
                    <Button variant="outline" className="border-line text-ink hover:bg-app"
                      onClick={() => appsImportRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Importer CSV
                    </Button>
                    <Button variant="outline" className="border-line text-ink hover:bg-app"
                      onClick={() => { window.location.href = "/api/admin/applications/export" }}>
                      <Download className="w-4 h-4 mr-2" /> Exporter CSV
                    </Button>
                    <Dialog open={appDialogOpen} onOpenChange={setAppDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-brand hover:bg-brand-hover text-white">
                          <Plus className="w-4 h-4 mr-2" />
                          Nouvelle application
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-surface">
                        <DialogHeader>
                          <DialogTitle className="text-ink">Créer une nouvelle application</DialogTitle>
                        </DialogHeader>
                        <ApplicationForm onSubmit={handleCreateApp} categories={categories} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...applications].sort((a, b) => a.ordre_affichage - b.ordre_affichage).map((app, index, sortedApps) => (
                    <div key={app.id} className="border border-line rounded-lg p-4">
                      <div className="flex items-center space-x-4 mb-4">
                        <AppAvatar app={app} size={48} />
                        <div className="flex-1">
                          <h3 className="font-medium text-ink">{app.nom}</h3>
                          <p className="text-sm text-ink-muted">Position: {index + 1}</p>
                        </div>
                        {/* Flèches de réordonnancement */}
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label="Monter"
                            title="Monter"
                            disabled={index === 0 || reordering}
                            onClick={() => handleMoveApp(app.id, "up")}
                            className="p-1 text-ink-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Descendre"
                            title="Descendre"
                            disabled={index === sortedApps.length - 1 || reordering}
                            onClick={() => handleMoveApp(app.id, "down")}
                            className="p-1 text-ink-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <a
                          href={app.app_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:text-brand-hover text-sm"
                        >
                          Ouvrir l'app
                        </a>
                        <div className="flex items-center space-x-2">
                          <AppCodeManager appId={app.id} appName={app.nom} />
                          <Dialog open={editAppDialogOpen} onOpenChange={setEditAppDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-line text-ink hover:bg-app"
                                onClick={() => handleEditApp(app)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-surface">
                              <DialogHeader>
                                <DialogTitle className="text-ink">Modifier l'application</DialogTitle>
                              </DialogHeader>
                              <ApplicationForm
                                application={editingApp}
                                onSubmit={(data) => editingApp && handleUpdateApp(editingApp.id, data)}
                                categories={categories}
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
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-ink">Gestion des accès utilisateurs</CardTitle>
                <div className="flex items-center space-x-4 mt-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Rechercher un utilisateur..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <Select value={accessFilter} onValueChange={(value: any) => setAccessFilter(value)}>
                    <SelectTrigger className="w-48 border-line">
                      <SelectValue placeholder="Filtrer par accès" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border border-line">
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
                    <div key={user.id} className="border border-line rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <UserAvatar name={user.nom} avatar={user.avatar} size={40} />
                          <div>
                            <p className="font-medium text-ink">{user.nom}</p>
                            <p className="text-sm text-ink-muted">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-sm text-ink-muted">
                          {applications.filter(app => hasAccess(user.id, app.id)).length} / {applications.length} applications
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {applications.map((app) => (
                          <div key={app.id} className="flex items-center justify-between p-3 border border-line rounded-md">
                            <div className="flex items-center space-x-3">
                              <AppAvatar app={app} size={32} />
                              <span className="text-sm font-medium text-ink">{app.nom}</span>
                            </div>
                            <Checkbox
                              checked={hasAccess(user.id, app.id)}
                              onCheckedChange={() => handleToggleAccess(user.id, app.id)}
                              className="border-line data-[state=checked]:bg-brand data-[state=checked]:border-brand"
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
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-ink flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  Configuration du serveur SMTP
                </CardTitle>
                <p className="text-ink-muted text-sm">
                  Configurez les paramètres SMTP pour l'envoi automatique d'emails aux utilisateurs
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="smtp_host" className="text-ink font-medium">Serveur SMTP</Label>
                    <Input
                      id="smtp_host"
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_port" className="text-ink font-medium">Port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_user" className="text-ink font-medium">Nom d'utilisateur</Label>
                    <Input
                      id="smtp_user"
                      type="email"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      placeholder="votre-email@gmail.com"
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_password" className="text-ink font-medium">Mot de passe</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      value={smtpConfig.password}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                      placeholder="Mot de passe ou App Password"
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="from_name" className="text-ink font-medium">Nom de l'expéditeur</Label>
                    <Input
                      id="from_name"
                      type="text"
                      value={smtpConfig.from_name}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                      placeholder="SMT HUB"
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="from_email" className="text-ink font-medium">Email de l'expéditeur</Label>
                    <Input
                      id="from_email"
                      type="email"
                      value={smtpConfig.from_email}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                      placeholder="noreply@smt.com"
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="smtp_secure"
                    checked={smtpConfig.secure}
                    onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, secure: !!checked })}
                  />
                  <Label htmlFor="smtp_secure" className="text-ink text-sm">
                    Utiliser SSL/TLS (recommandé pour Gmail)
                  </Label>
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={handleSaveSmtpConfig}
                    className="bg-brand hover:bg-brand-hover text-white"
                  >
                    Sauvegarder la configuration
                  </Button>
                  <Button
                    onClick={handleTestSmtpConfig}
                    variant="outline"
                    className="border-brand text-brand hover:bg-brand hover:text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Tester la configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Templates d'emails */}
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-ink flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Templates d'emails automatiques
                </CardTitle>
                <p className="text-ink-muted text-sm">
                  Configurez les emails automatiques envoyés aux utilisateurs lors de différents événements
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email de création de compte */}
                <div className="border border-line rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-ink">Email de création de compte</h3>
                      <p className="text-sm text-ink-muted">
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
                    <Label className="text-ink font-medium">Sujet de l'email</Label>
                    <Input
                      value={emailTemplates.user_created.subject}
                      onChange={(e) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          user_created: { ...emailTemplates.user_created, subject: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-app rounded-md">
                    <p className="text-sm text-ink-muted">
                      <strong>Contenu de l'email :</strong> Bonjour [NOM], votre compte a été créé avec succès.
                      Pour des raisons de sécurité, aucun mot de passe n'est transmis par email : l'utilisateur
                      reçoit un lien sécurisé (valable 24 h) pour définir lui-même son mot de passe.
                    </p>
                  </div>
                </div>

                {/* Email de modification de profil */}
                <div className="border border-line rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-ink">Email de modification de profil</h3>
                      <p className="text-sm text-ink-muted">
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
                    <Label className="text-ink font-medium">Sujet de l'email</Label>
                    <Input
                      value={emailTemplates.user_updated.subject}
                      onChange={(e) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          user_updated: { ...emailTemplates.user_updated, subject: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-app rounded-md">
                    <p className="text-sm text-ink-muted">
                      <strong>Contenu de l'email :</strong> Bonjour [NOM], votre profil SMT HUB a été modifié.
                      Modifications apportées : [MODIFICATIONS]. Si vous n'êtes pas à l'origine de ces modifications,
                      contactez votre administrateur.
                    </p>
                  </div>
                </div>

                {/* Email d'accès à une nouvelle application */}
                <div className="border border-line rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-ink">Email d'accès à une nouvelle application</h3>
                      <p className="text-sm text-ink-muted">
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
                    <Label className="text-ink font-medium">Sujet de l'email</Label>
                    <Input
                      value={emailTemplates.app_access_granted.subject}
                      onChange={(e) =>
                        setEmailTemplates({
                          ...emailTemplates,
                          app_access_granted: { ...emailTemplates.app_access_granted, subject: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-app rounded-md">
                    <p className="text-sm text-ink-muted">
                      <strong>Contenu de l'email :</strong> Bonjour [NOM], une nouvelle application "[NOM_APPLICATION]"
                      est maintenant disponible dans votre SMT HUB. Connectez-vous sur [URL] pour y accéder.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveEmailTemplates}
                    className="bg-brand hover:bg-brand-hover text-white"
                  >
                    Sauvegarder les templates
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Email Templates Section */}
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-ink flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Templates d'emails automatiques
                    </CardTitle>
                    <p className="text-ink-muted text-sm">
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
                      <Label htmlFor="templateSelect" className="text-ink font-medium">Sélectionner un template</Label>
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
                          className="p-4 border border-line rounded-lg hover:bg-app cursor-pointer"
                          onClick={() => {
                            setSelectedTemplate(template.id)
                            setTemplateDialogOpen(true)
                          }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium text-ink">{template.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-ink-muted mb-3">{template.description}</p>
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
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mx-auto mb-4"></div>
                    <p className="text-ink-muted">Chargement des templates...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Section */}
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-ink flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Paramètres généraux des templates
                </CardTitle>
                <p className="text-ink-muted text-sm">
                  Configurez les paramètres globaux pour tous les templates d'emails
                </p>
              </CardHeader>
              <CardContent>
                {emailTemplateConfig ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName" className="text-ink font-medium">Nom de l'entreprise</Label>
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
                        <Label htmlFor="supportEmail" className="text-ink font-medium">Email de support</Label>
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
                        <Label htmlFor="websiteUrl" className="text-ink font-medium">URL du site web</Label>
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
                        <Label htmlFor="logoUrl" className="text-ink font-medium">URL du logo</Label>
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
                        <Label htmlFor="primaryColor" className="text-ink font-medium">Couleur primaire</Label>
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
                        <Label htmlFor="secondaryColor" className="text-ink font-medium">Couleur secondaire</Label>
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
                      className="bg-brand hover:bg-brand-hover text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder les paramètres
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mx-auto mb-4"></div>
                    <p className="text-ink-muted">Chargement des paramètres...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates d'emails Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-ink flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Templates d'emails automatiques
                    </CardTitle>
                    <p className="text-ink-muted text-sm">
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
                      <div key={template.id} className="border border-line rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-ink">{template.name}</h3>
                            <p className="text-sm text-ink-muted">{template.description}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => {
                                setSelectedTemplate(template.id)
                                setTemplateDialogOpen(true)
                              }}
                              variant="outline"
                              size="sm"
                              className="border-line text-ink hover:bg-app"
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
                              className="border-line text-ink hover:bg-app"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Tester
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-ink">Sujet :</span>
                            <p className="text-ink-muted mt-1">{template.subject}</p>
                          </div>
                          <div>
                            <span className="font-medium text-ink">Variables disponibles :</span>
                            <p className="text-ink-muted mt-1">{template.variables.join(", ")}</p>
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
            <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-ink flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Paramètres généraux des templates
                </CardTitle>
                <p className="text-ink-muted text-sm">
                  Configurez les paramètres globaux utilisés dans tous les templates d'emails
                </p>
              </CardHeader>
              <CardContent>
                {emailTemplateConfig && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="companyName" className="text-ink font-medium">Nom de l'entreprise</Label>
                      <Input
                        id="companyName"
                        value={emailTemplateConfig.settings.companyName}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.companyName = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supportEmail" className="text-ink font-medium">Email de support</Label>
                      <Input
                        id="supportEmail"
                        type="email"
                        value={emailTemplateConfig.settings.supportEmail}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.supportEmail = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="websiteUrl" className="text-ink font-medium">URL du site</Label>
                      <Input
                        id="websiteUrl"
                        value={emailTemplateConfig.settings.websiteUrl}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.websiteUrl = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="primaryColor" className="text-ink font-medium">Couleur primaire</Label>
                      <Input
                        id="primaryColor"
                        type="color"
                        value={emailTemplateConfig.settings.primaryColor}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.primaryColor = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full h-10 border border-line rounded-md bg-surface"
                      />
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor" className="text-ink font-medium">Couleur secondaire</Label>
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={emailTemplateConfig.settings.secondaryColor}
                        onChange={(e) => {
                          const newConfig = { ...emailTemplateConfig }
                          newConfig.settings.secondaryColor = e.target.value
                          setEmailTemplateConfig(newConfig)
                        }}
                        className="w-full h-10 border border-line rounded-md bg-surface"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        onClick={() => handleUpdateSettings(emailTemplateConfig.settings)}
                        className="bg-brand hover:bg-brand-hover text-white"
                      >
                        Sauvegarder les paramètres
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
                      </TabsContent>

            {/* Groupes Tab */}
            <TabsContent value="groups" className="space-y-6">
              <GroupsPanel users={users} applications={applications} onApplied={refreshUsers} />
            </TabsContent>

            {/* Annonces Tab */}
            <TabsContent value="announcements" className="space-y-6">
              <AnnouncementsPanel users={users} />
            </TabsContent>

            {/* Activité utilisateur Tab */}
            <TabsContent value="activity" className="space-y-6">
              <UserActivityPanel users={users} initialUserId={activityUserId} />
            </TabsContent>

            {/* Statistiques Tab */}
            <TabsContent value="stats" className="space-y-6">
              <StatsPanel applications={applications} users={users} />
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="space-y-6">
              <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-ink flex items-center">
                        <Activity className="w-5 h-5 mr-2" />
                        Journal d'activité
                      </CardTitle>
                      <p className="text-ink-muted text-sm">
                        Consultez l'historique complet des actions administratives
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={loadLogs}
                        variant="outline"
                        className="border-line text-ink hover:bg-app"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Actualiser
                      </Button>
                      <Button
                        onClick={handleDeleteSelectedLogs}
                        variant="outline"
                        disabled={selectedLogIds.length === 0}
                        className="border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer la sélection ({selectedLogIds.length})
                      </Button>
                      <Button
                        onClick={handleClearAllLogs}
                        variant="outline"
                        className="border-red-400 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Vider le journal
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filtres */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
                                         <div>
                       <Label htmlFor="logLevel" className="text-ink font-medium">Niveau</Label>
                       <Select
                         value={logFilters.level || "all"}
                         onValueChange={(value) => updateLogFilter({ level: value === "all" ? "" : value })}
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
                       <Label htmlFor="logUser" className="text-ink font-medium">Utilisateur</Label>
                       <Select
                         value={logFilters.userId || "all"}
                         onValueChange={(value) => updateLogFilter({ userId: value === "all" ? "" : value })}
                       >
                         <SelectTrigger className="w-full">
                           <SelectValue placeholder="Tous les utilisateurs" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="all">Tous les utilisateurs</SelectItem>
                           {users.map((u) => (
                             <SelectItem key={u.id} value={String(u.id)}>{u.nom}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>
                     <div>
                       <Label htmlFor="logStartDate" className="text-ink font-medium">Du</Label>
                       <Input
                         id="logStartDate"
                         type="date"
                         value={logFilters.startDate}
                         onChange={(e) => updateLogFilter({ startDate: e.target.value })}
                         className="w-full"
                       />
                     </div>
                     <div>
                       <Label htmlFor="logEndDate" className="text-ink font-medium">Au</Label>
                       <Input
                         id="logEndDate"
                         type="date"
                         value={logFilters.endDate}
                         onChange={(e) => updateLogFilter({ endDate: e.target.value })}
                         className="w-full"
                       />
                     </div>
                     <div>
                       <Label htmlFor="logAction" className="text-ink font-medium">Action</Label>
                       <Input
                         id="logAction"
                         value={logFilters.action}
                         onChange={(e) => updateLogFilter({ action: e.target.value })}
                         placeholder="Filtrer par action..."
                         className="w-full"
                       />
                     </div>
                     <div>
                       <Label htmlFor="logStatus" className="text-ink font-medium">Statut</Label>
                       <Select
                         value={logFilters.status || "all"}
                         onValueChange={(value) => updateLogFilter({ status: value === "all" ? "" : value })}
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
                      <Label htmlFor="logLimit" className="text-ink font-medium">Limite</Label>
                      <Select
                        value={logFilters.limit.toString()}
                        onValueChange={(value) => updateLogFilter({ limit: parseInt(value) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 entrées</SelectItem>
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
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mx-auto mb-4"></div>
                      <p className="text-ink-muted">Chargement des logs...</p>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-ink-muted">Aucun log trouvé</p>
                    </div>
                  ) : (
                    <>
                    <label className="flex items-center gap-2 text-sm text-ink-muted mb-2 cursor-pointer">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllPage} />
                      Tout sélectionner sur cette page
                    </label>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-4 rounded-lg border ${
                            selectedLogIds.includes(log.id) ? "ring-2 ring-brand " : ""
                          }${
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
                              <input
                                type="checkbox"
                                checked={selectedLogIds.includes(log.id)}
                                onChange={() => toggleLogSelection(log.id)}
                                aria-label="Sélectionner cette ligne"
                              />
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
                              <span className="text-sm font-medium text-ink">
                                {log.action}
                              </span>
                            </div>
                            <span className="text-xs text-ink-muted">
                              {new Date(log.timestamp).toLocaleString("fr-FR")}
                            </span>
                          </div>
                          <p className="text-sm text-ink-muted mb-2">{log.details}</p>
                          {log.userName && (
                            <p className="text-xs text-ink-muted">
                              <strong>Utilisateur :</strong> {log.userName}
                            </p>
                          )}
                          {log.errorMessage && (
                            <p className="text-xs text-red-600 mt-1">
                              <strong>Erreur :</strong> {log.errorMessage}
                            </p>
                          )}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 text-xs text-ink-muted">
                              <strong>Métadonnées :</strong>
                              <pre className="mt-1 bg-surface p-2 rounded border text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    </>
                  )}
                  {/* Pagination */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-ink-muted">
                      Page {logsPage + 1} / {Math.max(1, Math.ceil(logsTotal / logFilters.limit))} • {logsTotal} entrée(s)
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        className="border-line text-ink hover:bg-app"
                        disabled={logsPage === 0 || logsLoading}
                        onClick={() => setLogsPage(Math.max(0, logsPage - 1))}
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        className="border-line text-ink hover:bg-app"
                        disabled={!logsHasMore || logsLoading}
                        onClick={() => setLogsPage(logsPage + 1)}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Backups Tab */}
            <TabsContent value="backups" className="space-y-6">
              <BackupsPanel />
            </TabsContent>
          </Tabs>
        </main>

      {/* Dialog pour éditer un template */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-ink">
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
            <DialogTitle className="text-ink">
              Tester le template : {emailTemplateConfig?.templates.find((t: any) => t.id === selectedTemplate)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testEmail" className="text-ink font-medium">Email de test</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
              />
            </div>
            <Button
              onClick={() => handleTestTemplate(selectedTemplate, testEmailAddress)}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              Générer l'aperçu
            </Button>
            {previewEmail && (
              <div className="border border-line rounded-lg p-4">
                <h4 className="font-semibold text-ink mb-2">Aperçu de l'email :</h4>
                <div className="mb-4">
                  <span className="font-medium text-ink">Sujet :</span>
                  <p className="text-ink-muted mt-1">{previewEmail.subject}</p>
                </div>
                {/* Aperçu rendu dans un iframe sandboxé : le HTML du template ne peut
                    exécuter aucun script ni accéder à la page (défense en profondeur). */}
                <iframe
                  title="Aperçu de l'email"
                  sandbox=""
                  srcDoc={previewEmail.html}
                  className="w-full h-80 border border-line rounded-lg bg-white"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Couleurs proposées pour un avatar « initiales ».
const USER_AVATAR_COLORS = ["#1877f2", "#42b883", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"]

// Composant de formulaire pour les utilisateurs
function UserForm({ user, onSubmit }: { user?: User | null, onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    nom: user?.nom || "",
    email: user?.email || "",
    role: user?.role || "utilisateur",
    mot_de_passe: ""
  })
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mettre à jour le formulaire quand l'utilisateur change
  useEffect(() => {
    if (user) {
      setFormData({
        nom: user.nom || "",
        email: user.email || "",
        role: user.role || "utilisateur",
        mot_de_passe: "" // Ne pas pré-remplir le mot de passe pour la sécurité
      })
      setAvatar(user.avatar ?? null)
    } else {
      setFormData({ nom: "", email: "", role: "utilisateur", mot_de_passe: "" })
      setAvatar(null)
    }
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError("")
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image trop volumineuse (max 2 Mo).")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (res.ok && data.url) setAvatar(data.url)
      else setAvatarError(data.error || "Échec du téléversement.")
    } catch {
      setAvatarError("Erreur lors du téléversement.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Pour la modification, ne pas envoyer le mot de passe s'il est vide
    const base: any = user && !formData.mot_de_passe
      ? { nom: formData.nom, email: formData.email, role: formData.role }
      : { ...formData }
    base.avatar = avatar
    onSubmit(base)
    if (!user) {
      setFormData({ nom: "", email: "", role: "utilisateur", mot_de_passe: "" })
      setAvatar(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Avatar */}
      <div>
        <Label className="text-ink font-medium">Avatar</Label>
        <div className="flex items-center gap-4 mt-2">
          <UserAvatar name={formData.nom || "?"} avatar={avatar} size={56} className="ring-2 ring-line" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} className="hidden" />
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="bg-surface-muted hover:bg-surface-muted text-ink text-sm px-3 py-1.5 rounded-md disabled:opacity-50">
                {uploading ? "Téléversement..." : "Téléverser une photo"}
              </Button>
              {avatar && (
                <Button type="button" onClick={() => setAvatar(null)}
                  className="bg-surface-muted hover:bg-surface-muted text-ink text-sm px-3 py-1.5 rounded-md">
                  Retirer
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {USER_AVATAR_COLORS.map((color) => {
                const value = `color:${color}`
                return (
                  <button key={color} type="button" aria-label={`Couleur ${color}`} onClick={() => setAvatar(value)}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${avatar === value ? "ring-2 ring-offset-1 ring-brand" : ""}`}
                    style={{ backgroundColor: color }} />
                )
              })}
            </div>
          </div>
        </div>
        {avatarError && <p className="text-red-600 text-xs mt-1">{avatarError}</p>}
      </div>
      <div>
        <Label htmlFor="nom" className="text-ink font-medium">Nom</Label>
        <Input
          id="nom"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="text-ink font-medium">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="mot_de_passe" className="text-ink font-medium">
          Mot de passe
          {user ? (
            <span className="text-ink-muted font-normal text-sm ml-1">(laisser vide pour ne pas modifier)</span>
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
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required={!user}
        />
      </div>
      <div>
        <Label htmlFor="role" className="text-ink font-medium">Rôle</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "utilisateur" })}>
          <SelectTrigger className="border-line">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface border border-line">
            <SelectItem value="utilisateur">Utilisateur</SelectItem>
            <SelectItem value="admin">Administrateur</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-brand hover:bg-brand-hover text-white">
        {user ? "Mettre à jour" : "Créer"}
      </Button>
    </form>
  )
}

// Gestion des dépôts de code d'une application : chargement d'un dossier
// (via sélecteur de dossier) ou d'une archive .zip, avec note, et possibilité
// d'ajouter d'autres dépôts plus tard. Réservé aux administrateurs.
function AppCodeManager({ appId, appName }: { appId: number; appName: string }) {
  const [open, setOpen] = useState(false)
  const [deposits, setDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<File[]>([])
  const [kind, setKind] = useState<"folder" | "zip">("folder")
  const [note, setNote] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  // Reconfirmation du mot de passe avant téléchargement / suppression
  const [pwPrompt, setPwPrompt] = useState<{ action: "download" | "delete"; depositId: string } | null>(null)
  const [pwValue, setPwValue] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwBusy, setPwBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/applications/${appId}/code`)
      if (res.ok) setDeposits(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const totalSize = (files: File[]) => files.reduce((s, f) => s + f.size, 0)
  const fmtSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`

  const onPickFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setError("")
    setKind("folder")
    setSelected(files)
  }
  const onPickZip = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setError("")
    setKind("zip")
    setSelected(files)
  }

  const resetSelection = () => {
    setSelected([])
    setNote("")
    if (folderInputRef.current) folderInputRef.current.value = ""
    if (zipInputRef.current) zipInputRef.current.value = ""
  }

  const upload = async () => {
    setError("")
    if (selected.length === 0) {
      setError("Choisissez un dossier ou une archive .zip.")
      return
    }
    if (totalSize(selected) > 50 * 1024 * 1024) {
      setError("Trop volumineux (max 50 Mo au total).")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("note", note)
      fd.append("kind", kind)
      const paths = selected.map((f) => (f as any).webkitRelativePath || f.name)
      fd.append("paths", JSON.stringify(paths))
      for (const f of selected) fd.append("files", f)
      const res = await fetch(`/api/admin/applications/${appId}/code`, { method: "POST", body: fd })
      if (res.ok) {
        resetSelection()
        await load()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Erreur lors du chargement.")
      }
    } catch {
      setError("Erreur réseau lors du chargement.")
    } finally {
      setUploading(false)
    }
  }

  // Ouvre la fenêtre de reconfirmation du mot de passe pour l'action demandée.
  const askPassword = (action: "download" | "delete", depositId: string) => {
    setPwValue("")
    setPwError("")
    setPwPrompt({ action, depositId })
  }

  const confirmPassword = async () => {
    if (!pwPrompt) return
    if (!pwValue) { setPwError("Saisissez votre mot de passe."); return }
    setPwBusy(true)
    setPwError("")
    try {
      const { action, depositId } = pwPrompt
      if (action === "delete") {
        const res = await fetch(`/api/admin/applications/${appId}/code/${depositId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwValue }),
        })
        if (res.ok) {
          setPwPrompt(null)
          await load()
        } else {
          const data = await res.json().catch(() => ({}))
          setPwError(data.error || "Échec de la suppression.")
        }
      } else {
        const res = await fetch(`/api/admin/applications/${appId}/code/${depositId}/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwValue }),
        })
        if (res.ok) {
          const blob = await res.blob()
          // Récupère le nom de fichier depuis l'en-tête Content-Disposition
          const cd = res.headers.get("Content-Disposition") || ""
          const m = cd.match(/filename="?([^"]+)"?/)
          const filename = m ? m[1] : `code-app${appId}.zip`
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
          setPwPrompt(null)
        } else {
          const data = await res.json().catch(() => ({}))
          setPwError(data.error || "Échec du téléchargement.")
        }
      }
    } catch {
      setPwError("Erreur réseau.")
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-line text-ink hover:bg-app" title="Dossiers de code">
          <Layers className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink">Dossiers de code — {appName}</DialogTitle>
        </DialogHeader>

        {/* Formulaire de chargement */}
        <div className="space-y-3 border border-line rounded-lg p-3">
          <p className="text-sm font-medium text-ink">Ajouter un dépôt</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              onChange={onPickFolder}
              {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as any)}
            />
            <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onPickZip} />
            <Button type="button" variant="outline" className="border-line text-ink hover:bg-app"
              onClick={() => folderInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Choisir un dossier
            </Button>
            <Button type="button" variant="outline" className="border-line text-ink hover:bg-app"
              onClick={() => zipInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Choisir un .zip
            </Button>
          </div>

          {selected.length > 0 ? (
            <p className="text-xs text-ink-muted">
              {kind === "zip" ? "Archive" : "Dossier"} sélectionné : {selected.length} fichier(s) — {fmtSize(totalSize(selected))}
              <button type="button" onClick={resetSelection} className="ml-2 text-ink-muted hover:text-red-600 underline">retirer</button>
            </p>
          ) : (
            <p className="text-xs text-ink-faint">Un dossier normal ou une archive .zip (max 50 Mo).</p>
          )}

          <div>
            <Label htmlFor={`note-${appId}`} className="text-ink text-sm">Note (optionnel)</Label>
            <textarea
              id={`note-${appId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ex. version 1.2, remis par le prestataire…"
              className="w-full mt-1 px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button onClick={upload} disabled={uploading || selected.length === 0}
            className="bg-brand hover:bg-brand-hover text-white">
            {uploading ? "Chargement…" : "Charger le dépôt"}
          </Button>
        </div>

        {/* Liste des dépôts existants */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Dépôts existants</p>
          {loading ? (
            <p className="text-sm text-ink-muted">Chargement…</p>
          ) : deposits.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucun dépôt pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {deposits.map((d) => (
                <li key={d.id} className="border border-line rounded-md p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {d.files?.length || 0} fichier(s) — {fmtSize(d.total_size || 0)}
                        <span className="text-ink-faint"> · {d.kind === "zip" ? "archive" : "dossier"}</span>
                      </p>
                      <p className="text-xs text-ink-muted">
                        {new Date(d.created_at).toLocaleString("fr-FR")} · {d.created_by}
                      </p>
                      {d.note ? <p className="text-sm text-ink mt-1 whitespace-pre-wrap break-words">{d.note}</p> : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => askPassword("download", d.id)}
                        className="p-1.5 text-ink-muted hover:text-brand"
                        title="Télécharger (.zip)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => askPassword("delete", d.id)} className="p-1.5 text-ink-muted hover:text-red-600" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Reconfirmation du mot de passe avant téléchargement / suppression */}
        {pwPrompt ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 rounded-lg">
            <div className="w-full max-w-sm rounded-lg bg-surface border border-line shadow-xl p-5">
              <h3 className="text-base font-semibold text-ink mb-1">Confirmer votre identité</h3>
              <p className="text-sm text-ink-muted mb-3">
                Saisissez votre mot de passe pour {pwPrompt.action === "delete" ? "supprimer" : "télécharger"} ce dépôt.
              </p>
              <Input
                type="password"
                value={pwValue}
                autoFocus
                onChange={(e) => setPwValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmPassword() } }}
                placeholder="Mot de passe"
                className="bg-surface border-line text-ink"
              />
              {pwError ? <p className="text-sm text-red-600 mt-2">{pwError}</p> : null}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" className="border-line text-ink hover:bg-app"
                  onClick={() => { setPwPrompt(null); setPwValue(""); setPwError("") }} disabled={pwBusy}>
                  Annuler
                </Button>
                <Button
                  onClick={confirmPassword}
                  disabled={pwBusy}
                  className={pwPrompt.action === "delete" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-brand hover:bg-brand-hover text-white"}
                >
                  {pwBusy ? "Vérification…" : pwPrompt.action === "delete" ? "Supprimer" : "Télécharger"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// Panneau d'administration des sauvegardes : créer une sauvegarde à la demande,
// lister celles présentes (y compris celles du cron), les télécharger et les
// supprimer. Chaque action sensible exige une reconfirmation du mot de passe.
function BackupsPanel() {
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // Configuration de la planification automatique
  const [cfg, setCfg] = useState<any>(null)
  const [cfgSaving, setCfgSaving] = useState(false)
  const [cfgSaved, setCfgSaved] = useState(false)

  // Reconfirmation du mot de passe : action en attente
  const [pw, setPw] = useState<{ action: "create" | "download" | "delete" | "restore" | "restore-upload"; name?: string; fileName?: string } | null>(null)
  const [pwValue, setPwValue] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  // Fichier choisi pour une restauration par import
  const restoreFileRef = useRef<HTMLInputElement>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [rb, rc] = await Promise.all([fetch("/api/admin/backups"), fetch("/api/admin/backups/config")])
      if (rb.ok) setBackups(await rb.json())
      else setError("Impossible de charger les sauvegardes.")
      if (rc.ok) setCfg(await rc.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const fmtSize = (b: number) =>
    b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`

  const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

  const saveConfig = async () => {
    if (!cfg) return
    setCfgSaving(true)
    setCfgSaved(false)
    try {
      const res = await fetch("/api/admin/backups/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      })
      if (res.ok) { setCfg(await res.json()); setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2500) }
    } finally {
      setCfgSaving(false)
    }
  }

  const ask = (action: "create" | "download" | "delete" | "restore", name?: string) => {
    setPwValue("")
    setPwError("")
    setNotice("")
    setPw({ action, name })
  }

  // L'admin a choisi un fichier d'archive à restaurer → ouvre la confirmation.
  const onPickRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    if (f) {
      setRestoreFile(f)
      setPwValue("")
      setPwError("")
      setNotice("")
      setPw({ action: "restore-upload", fileName: f.name })
    }
    if (restoreFileRef.current) restoreFileRef.current.value = ""
  }

  const confirmPw = async () => {
    if (!pw) return
    if (!pwValue) { setPwError("Saisissez votre mot de passe."); return }
    setPwBusy(true)
    setPwError("")
    try {
      if (pw.action === "create") {
        const res = await fetch("/api/admin/backups", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwValue }),
        })
        if (res.ok) { setPw(null); await load() }
        else { const d = await res.json().catch(() => ({})); setPwError(d.error || "Échec de la création.") }
      } else if (pw.action === "delete" && pw.name) {
        const res = await fetch(`/api/admin/backups/${encodeURIComponent(pw.name)}`, {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwValue }),
        })
        if (res.ok) { setPw(null); await load() }
        else { const d = await res.json().catch(() => ({})); setPwError(d.error || "Échec de la suppression.") }
      } else if (pw.action === "download" && pw.name) {
        const res = await fetch(`/api/admin/backups/${encodeURIComponent(pw.name)}/download`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwValue }),
        })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url; a.download = pw.name
          document.body.appendChild(a); a.click(); a.remove()
          URL.revokeObjectURL(url)
          setPw(null)
        } else { const d = await res.json().catch(() => ({})); setPwError(d.error || "Échec du téléchargement.") }
      } else if (pw.action === "restore" && pw.name) {
        const res = await fetch(`/api/admin/backups/${encodeURIComponent(pw.name)}/restore`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwValue }),
        })
        if (res.ok) {
          const d = await res.json().catch(() => ({}))
          setPw(null)
          setNotice(
            "Restauration effectuée." +
            (d.safety ? ` Vos données précédentes ont été conservées dans « ${d.safety} » (sur le serveur).` : "") +
            " Reconnectez-vous si nécessaire."
          )
          await load()
        } else { const d = await res.json().catch(() => ({})); setPwError(d.error || "Échec de la restauration.") }
      } else if (pw.action === "restore-upload" && restoreFile) {
        const fd = new FormData()
        fd.append("password", pwValue)
        fd.append("file", restoreFile)
        const res = await fetch("/api/admin/backups/restore-upload", { method: "POST", body: fd })
        if (res.ok) {
          const d = await res.json().catch(() => ({}))
          setPw(null)
          setRestoreFile(null)
          setNotice(
            "Restauration effectuée." +
            (d.safety ? ` Vos données précédentes ont été conservées dans « ${d.safety} » (sur le serveur).` : "") +
            " Reconnectez-vous si nécessaire."
          )
          await load()
        } else { const d = await res.json().catch(() => ({})); setPwError(d.error || "Échec de la restauration.") }
      }
    } catch {
      setPwError("Erreur réseau.")
    } finally {
      setPwBusy(false)
    }
  }

  const pwLabel = (a: string) =>
    a === "create" ? "créer une sauvegarde"
      : a === "delete" ? "supprimer cette sauvegarde"
      : a === "restore" ? "RESTAURER cette sauvegarde (remplace les données actuelles)"
      : a === "restore-upload" ? "RESTAURER à partir du fichier importé (remplace les données actuelles)"
      : "télécharger cette sauvegarde"

  return (
    <div className="space-y-6">
      {/* Planification automatique */}
      <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
        <CardHeader>
          <CardTitle className="text-ink">Sauvegarde automatique</CardTitle>
          <p className="text-sm text-ink-muted">
            L'application effectue elle-même les sauvegardes selon cette planification (aucun cron système requis).
          </p>
        </CardHeader>
        <CardContent>
          {!cfg ? (
            <p className="text-sm text-ink-muted">Chargement…</p>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={!!cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                  className="h-4 w-4 accent-[var(--brand,#1877f2)]" />
                Activer la sauvegarde automatique
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-ink text-sm">Fréquence</Label>
                  <select value={cfg.frequency} onChange={(e) => setCfg({ ...cfg, frequency: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-line rounded-md bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="daily">Quotidienne</option>
                    <option value="weekly">Hebdomadaire</option>
                  </select>
                </div>
                {cfg.frequency === "weekly" ? (
                  <div>
                    <Label className="text-ink text-sm">Jour</Label>
                    <select value={cfg.weekday} onChange={(e) => setCfg({ ...cfg, weekday: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 border border-line rounded-md bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                      {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                    </select>
                  </div>
                ) : null}
                <div>
                  <Label className="text-ink text-sm">Heure</Label>
                  <select value={cfg.hour} onChange={(e) => setCfg({ ...cfg, hour: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-line rounded-md bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-ink text-sm">Rétention (jours)</Label>
                  <Input type="number" min={1} max={365} value={cfg.retentionDays}
                    onChange={(e) => setCfg({ ...cfg, retentionDays: Number(e.target.value) })}
                    className="mt-1 bg-surface border-line text-ink" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={saveConfig} disabled={cfgSaving} className="bg-brand hover:bg-brand-hover text-white">
                  {cfgSaving ? "Enregistrement…" : "Enregistrer la planification"}
                </Button>
                {cfgSaved ? <span className="text-sm text-green-600">✓ Enregistré</span> : null}
                {cfg.lastRun ? (
                  <span className="text-xs text-ink-muted">Dernière auto : {new Date(cfg.lastRun).toLocaleString("fr-FR")}</span>
                ) : null}
              </div>
              <p className="text-xs text-ink-faint">
                Les anciennes sauvegardes au-delà de la rétention sont supprimées automatiquement. L'heure est celle du serveur.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste + actions */}
      <Card className="relative bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
        <CardHeader>
          <div className="flex flex-col items-center text-center gap-3">
            <div>
              <CardTitle className="text-ink">Sauvegardes</CardTitle>
              <p className="text-sm text-ink-muted">
                Archive complète des données (utilisateurs, applications, coffre-fort, dépôts de code, annonces…) et des secrets.
                Les sauvegardes automatiques apparaissent aussi ici.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" className="border-line text-ink hover:bg-app" onClick={load} title="Rafraîchir">
                <RotateCcw className="w-4 h-4" />
              </Button>
              <input ref={restoreFileRef} type="file" accept=".zip,.tar.gz,application/zip,application/gzip" className="hidden" onChange={onPickRestoreFile} />
              <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => restoreFileRef.current?.click()}>
                <RotateCcw className="w-4 h-4 mr-2" /> Restaurer depuis un fichier
              </Button>
              <Button className="bg-brand hover:bg-brand-hover text-white" onClick={() => ask("create")}>
                <Save className="w-4 h-4 mr-2" /> Sauvegarder maintenant
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notice ? <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2 mb-3">{notice}</p> : null}
          {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-ink-muted">Chargement…</p>
          ) : backups.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune sauvegarde pour l'instant. Cliquez sur « Sauvegarder maintenant ».</p>
          ) : (
            <ul className="space-y-2">
              {backups.map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-2 border border-line rounded-md p-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{b.name}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(b.created_at).toLocaleString("fr-FR")} · {fmtSize(b.size)}
                      <span className="text-ink-faint"> · {b.kind === "tar.gz" ? "auto" : "manuelle"}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => ask("restore", b.name)}>
                      <RotateCcw className="w-4 h-4 mr-1.5" /> Restaurer
                    </Button>
                    <button type="button" onClick={() => ask("download", b.name)} className="p-1.5 text-ink-muted hover:text-brand" title="Télécharger">
                      <Download className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => ask("delete", b.name)} className="p-1.5 text-ink-muted hover:text-red-600" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>

        {/* Reconfirmation du mot de passe */}
        {pw ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 rounded-lg">
            <div className="w-full max-w-sm rounded-lg bg-surface border border-line shadow-xl p-5">
              <h3 className="text-base font-semibold text-ink mb-1">Confirmer votre identité</h3>
              {pw.action === "restore" || pw.action === "restore-upload" ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mb-3">
                  ⚠️ La restauration <strong>remplace les données actuelles</strong>. Vos données présentes seront d'abord copiées par sécurité, puis remplacées.
                  {pw.fileName ? <><br />Fichier : <strong>{pw.fileName}</strong></> : null}
                </p>
              ) : null}
              <p className="text-sm text-ink-muted mb-3">Saisissez votre mot de passe pour {pwLabel(pw.action)}.</p>
              <Input type="password" value={pwValue} autoFocus
                onChange={(e) => setPwValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmPw() } }}
                placeholder="Mot de passe" className="bg-surface border-line text-ink" />
              {pwError ? <p className="text-sm text-red-600 mt-2">{pwError}</p> : null}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" className="border-line text-ink hover:bg-app"
                  onClick={() => { setPw(null); setPwValue(""); setPwError(""); setRestoreFile(null) }} disabled={pwBusy}>
                  Annuler
                </Button>
                <Button onClick={confirmPw} disabled={pwBusy}
                  className={pw.action === "delete" || pw.action === "restore" || pw.action === "restore-upload" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-brand hover:bg-brand-hover text-white"}>
                  {pwBusy ? "Vérification…" : pw.action === "create" ? "Sauvegarder" : pw.action === "delete" ? "Supprimer" : (pw.action === "restore" || pw.action === "restore-upload") ? "Restaurer" : "Télécharger"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

// Composant de formulaire pour les applications
function ApplicationForm({ application, onSubmit, categories = [] }: { application?: Application | null, onSubmit: (data: any) => void, categories?: Category[] }) {
  const [formData, setFormData] = useState({
    nom: application?.nom || "",
    app_url: application?.app_url || "",
    image_url: application?.image_url || "",
    ordre_affichage: application?.ordre_affichage || 1,
    avatar_color: application?.avatar_color || "#1877f2",
    category: (application as any)?.category || ""
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState("")
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError("")
    // Le logo est stocké EN BASE64 directement dans l'application → limite serrée
    // pour ne pas alourdir l'enregistrement (200 Ko de fichier ≈ 270 Ko de texte).
    if (file.size > 200 * 1024) {
      setLogoError("Logo trop volumineux (max 200 Ko). Réduisez/redimensionnez l'image.")
      if (logoInputRef.current) logoInputRef.current.value = ""
      return
    }
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setLogoError("Format non supporté (PNG, JPG, WEBP ou SVG).")
      if (logoInputRef.current) logoInputRef.current.value = ""
      return
    }
    setUploadingLogo(true)
    try {
      // Lecture locale en data URI base64 — aucun fichier n'est stocké sur le serveur.
      const dataUri: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error("read error"))
        reader.readAsDataURL(file)
      })
      setFormData((prev) => ({ ...prev, image_url: dataUri }))
    } catch {
      setLogoError("Impossible de lire le fichier.")
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ""
    }
  }

  // Mettre à jour le formulaire quand l'application change
  useEffect(() => {
    if (application) {
      setFormData({
        nom: application.nom || "",
        app_url: application.app_url || "",
        image_url: application.image_url || "",
        ordre_affichage: application.ordre_affichage || 1,
        avatar_color: application.avatar_color || "#1877f2",
        category: (application as any).category || ""
      })
    } else {
      setFormData({ nom: "", app_url: "", image_url: "", ordre_affichage: 1, avatar_color: "#1877f2", category: "" })
    }
  }, [application])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    if (!application) {
      setFormData({ nom: "", app_url: "", image_url: "", ordre_affichage: 1, avatar_color: "#1877f2", category: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nom" className="text-ink font-medium">Nom de l'application</Label>
        <Input
          id="nom"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="avatar_color" className="text-ink font-medium">Couleur de fond de l'avatar</Label>
        <div className="flex items-center space-x-3">
          <Input
            id="avatar_color"
            type="color"
            value={formData.avatar_color}
            onChange={(e) => setFormData({ ...formData, avatar_color: e.target.value })}
            className="w-16 h-10 p-1 border border-line rounded-md bg-surface"
          />
          <span className="text-sm text-ink-muted">{formData.avatar_color}</span>
        </div>
      </div>
      <div>
        <Label htmlFor="app_url" className="text-ink font-medium">URL de l'application</Label>
        <Input
          id="app_url"
          type="url"
          value={formData.app_url}
          onChange={(e) => setFormData({ ...formData, app_url: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
      </div>
      <div>
        <Label htmlFor="category" className="text-ink font-medium">
          Catégorie
          <span className="text-ink-muted font-normal text-sm ml-1">(optionnel - gérée dans « Catégories d'applications »)</span>
        </Label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
        >
          <option value="">— Aucune —</option>
          {/* Catégorie déjà affectée mais absente de la liste (ex. import) : on la garde disponible. */}
          {formData.category && !categories.some((c) => c.name === formData.category) ? (
            <option value={formData.category}>{formData.category}</option>
          ) : null}
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="image_url" className="text-ink font-medium">
          Logo de l'application
          <span className="text-ink-muted font-normal text-sm ml-1">(optionnel - avatar avec initiales si vide)</span>
        </Label>

        <div className="flex items-center gap-3 mt-1">
          {/* Aperçu du logo */}
          {formData.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={formData.image_url} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-line bg-surface" />
          ) : (
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold border border-line" style={{ backgroundColor: formData.avatar_color }}>
              {(formData.nom || "?").trim().split(/\s+/).map(w => w.charAt(0)).join("").substring(0, 2).toUpperCase()}
            </div>
          )}
          <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
          <Button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
            className="bg-brand hover:bg-brand-hover text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
            {uploadingLogo ? "Téléversement..." : "Téléverser un logo"}
          </Button>
          {formData.image_url && (
            <Button type="button" onClick={() => setFormData({ ...formData, image_url: "" })}
              className="bg-surface-muted hover:bg-surface-muted text-ink text-sm px-3 py-2 rounded-md">
              Retirer
            </Button>
          )}
        </div>
        {logoError && <p className="text-red-600 text-xs mt-1">{logoError}</p>}

        {/* Ou coller une URL d'image (type text : accepte aussi les chemins /uploads/... des logos téléversés) */}
        <Input
          id="image_url"
          type="text"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          placeholder="… ou coller une URL : https://exemple.com/logo.png"
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 mt-2"
        />
      </div>
      <div>
        <Label htmlFor="ordre_affichage" className="text-ink font-medium">Ordre d'affichage</Label>
        <Input
          id="ordre_affichage"
          type="number"
          min="1"
          value={formData.ordre_affichage}
          onChange={(e) => setFormData({ ...formData, ordre_affichage: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
      </div>
      <Button type="submit" className="w-full bg-brand hover:bg-brand-hover text-white">
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
        <Label htmlFor="templateName" className="text-ink font-medium">Nom du template</Label>
        <Input
          id="templateName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
      </div>

      <div>
        <Label htmlFor="templateSubject" className="text-ink font-medium">Sujet de l'email</Label>
        <Input
          id="templateSubject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
          required
        />
                  <p className="text-xs text-ink-muted mt-1">
            Utilisez {'{{variable}}'} pour insérer des variables dynamiques
          </p>
      </div>

      <div>
        <Label htmlFor="templateDescription" className="text-ink font-medium">Description</Label>
        <Input
          id="templateDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200"
        />
      </div>

      <div>
        <Label htmlFor="templateHtml" className="text-ink font-medium">Contenu HTML</Label>
        <textarea
          id="templateHtml"
          value={formData.html}
          onChange={(e) => setFormData({ ...formData, html: e.target.value })}
          rows={15}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 font-mono text-sm"
          required
        />
                    <p className="text-xs text-ink-muted mt-1">
              HTML avec styles inline. Utilisez {'{{variable}}'} pour les variables dynamiques.
            </p>
      </div>

      <div>
        <Label htmlFor="templateText" className="text-ink font-medium">Version texte</Label>
        <textarea
          id="templateText"
          value={formData.text}
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
          rows={10}
          className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 font-mono text-sm"
          required
        />
        <p className="text-xs text-ink-muted mt-1">
          Version texte simple pour les clients email qui ne supportent pas HTML.
        </p>
      </div>

      <div className="flex space-x-4">
        <Button type="submit" className="bg-brand hover:bg-brand-hover text-white">
          Sauvegarder les modifications
        </Button>
        <Button type="button" variant="outline" className="border-line text-ink hover:bg-app">
          Annuler
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Panneau : Annonces (bannières publiées aux utilisateurs)
// ---------------------------------------------------------------------------
interface AnnItem { id: string; message: string; level: "info" | "warning" | "success"; active: boolean; created_at: string; created_by: string; start_date?: string | null; end_date?: string | null; audience?: "all" | "group" | "users"; group_id?: string | null; user_ids?: number[]; dismissible?: boolean }

// Statut d'affichage d'une annonce programmée (côté admin)
function annStatus(a: AnnItem): { label: string; cls: string } {
  if (!a.active) return { label: "désactivée", cls: "bg-surface-muted text-ink-faint" }
  const now = Date.now()
  if (a.start_date && now < new Date(a.start_date).getTime()) return { label: "programmée", cls: "bg-blue-100 text-blue-800" }
  if (a.end_date && now > new Date(a.end_date).getTime()) return { label: "expirée", cls: "bg-surface-muted text-ink-faint" }
  if (a.start_date || a.end_date) return { label: "en cours", cls: "bg-green-100 text-green-800" }
  return { label: "permanente", cls: "bg-green-100 text-green-800" }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ""
  try { return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) } catch { return "" }
}

function AnnouncementsPanel({ users }: { users: User[] }) {
  const [items, setItems] = useState<AnnItem[]>([])
  const [message, setMessage] = useState("")
  const [level, setLevel] = useState<"info" | "warning" | "success">("info")
  const [mode, setMode] = useState<"permanent" | "scheduled">("permanent")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Ciblage
  const [audience, setAudience] = useState<"all" | "group" | "users">("all")
  const [groupId, setGroupId] = useState("")
  const [targetUsers, setTargetUsers] = useState<number[]>([])
  const [groups, setGroups] = useState<{ id: string; nom: string; member_ids: number[] }[]>([])
  const [dismissible, setDismissible] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const standardUsers = users.filter((u) => u.role !== "admin")

  const resetForm = () => {
    setEditId(null); setMessage(""); setLevel("info"); setMode("permanent")
    setStartDate(""); setEndDate(""); setAudience("all"); setGroupId(""); setTargetUsers([]); setDismissible(true); setError("")
  }

  // Charge une annonce existante dans le formulaire pour la modifier
  const startEdit = (a: AnnItem) => {
    setEditId(a.id)
    setMessage(a.message)
    setLevel(a.level)
    setMode(a.start_date || a.end_date ? "scheduled" : "permanent")
    const toLocal = (iso?: string | null) => {
      if (!iso) return ""
      const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0")
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
    }
    setStartDate(toLocal(a.start_date))
    setEndDate(toLocal(a.end_date))
    setAudience(a.audience || "all")
    setGroupId(a.group_id || "")
    setTargetUsers(a.user_ids || [])
    setDismissible(a.dismissible !== false)
    setError("")
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const load = async () => {
    try {
      const res = await fetch("/api/announcements?all=1")
      if (res.ok) setItems((await res.json()).announcements || [])
      const gr = await fetch("/api/admin/groups")
      if (gr.ok) setGroups((await gr.json()).groups || [])
    } catch { /* silencieux */ }
  }
  useEffect(() => { load() }, [])

  const publish = async () => {
    if (!message.trim()) return
    setError("")
    if (mode === "scheduled" && startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("La date de fin doit être postérieure à la date de début.")
      return
    }
    if (audience === "group" && !groupId) { setError("Veuillez choisir un groupe."); return }
    if (audience === "users" && targetUsers.length === 0) { setError("Veuillez choisir au moins un utilisateur."); return }
    setLoading(true)
    try {
      const body: any = { message, level, audience, dismissible }
      // En modification, on envoie toujours les dates (pour pouvoir les effacer) ;
      // en création, seulement si mode programmé.
      if (mode === "scheduled") {
        body.start_date = startDate ? new Date(startDate).toISOString() : null
        body.end_date = endDate ? new Date(endDate).toISOString() : null
      } else if (editId) {
        body.start_date = null
        body.end_date = null
      }
      if (audience === "group") body.group_id = groupId
      if (audience === "users") body.user_ids = targetUsers
      const res = editId
        ? await fetch("/api/announcements", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, id: editId }) })
        : await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (res.ok) {
        resetForm(); await load()
      } else setError(data.error || "Erreur lors de l'enregistrement.")
    } finally { setLoading(false) }
  }
  const toggle = async (id: string) => {
    await fetch("/api/announcements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    await load()
  }
  const remove = async (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return
    await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    await load()
  }

  const badgeColor: Record<string, string> = {
    info: "bg-blue-100 text-blue-800",
    warning: "bg-amber-100 text-amber-800",
    success: "bg-green-100 text-green-800",
  }

  return (
    <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
      <CardHeader>
        <CardTitle className="text-ink flex items-center gap-2"><Megaphone className="w-5 h-5" /> Annonces</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-ink font-medium">{editId ? "Modifier l'annonce" : "Nouvelle annonce"}</Label>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message affiché à tous les utilisateurs…" className="bg-surface border-line text-ink" />
          <div className="flex flex-wrap items-center gap-3">
            <select value={level} onChange={(e) => setLevel(e.target.value as any)} className="border border-line rounded-md bg-surface text-ink px-3 h-10">
              <option value="info">Information</option>
              <option value="warning">Avertissement</option>
              <option value="success">Succès</option>
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="border border-line rounded-md bg-surface text-ink px-3 h-10">
              <option value="permanent">Permanente</option>
              <option value="scheduled">Programmée (dates)</option>
            </select>
            <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="border border-line rounded-md bg-surface text-ink px-3 h-10">
              <option value="all">Tout le monde</option>
              <option value="group">Un groupe</option>
              <option value="users">Des utilisateurs</option>
            </select>
            {audience === "group" && (
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="border border-line rounded-md bg-surface text-ink px-3 h-10">
                <option value="">— choisir un groupe —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.member_ids.length})</option>)}
              </select>
            )}
          </div>

          {audience === "users" && (
            <div>
              <p className="text-sm text-ink-muted mb-1">Destinataires :</p>
              <div className="space-y-1 max-h-40 overflow-auto border border-line rounded-md p-2">
                {standardUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer py-1">
                    <input type="checkbox" checked={targetUsers.includes(u.id)}
                      onChange={() => setTargetUsers((prev) => prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id])} />
                    {u.nom} <span className="text-ink-faint">({u.email})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === "scheduled" && (
            <div className="flex flex-wrap items-end gap-4 border border-line rounded-md p-3 bg-app/40">
              <div>
                <Label className="text-ink-muted text-xs">Date de début</Label>
                <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-surface border-line text-ink" />
              </div>
              <div>
                <Label className="text-ink-muted text-xs">Date de fin</Label>
                <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-surface border-line text-ink" />
              </div>
              <p className="text-xs text-ink-faint w-full">Laissez un champ vide pour ne pas borner ce côté (ex. début vide = affichée immédiatement jusqu'à la date de fin).</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
            Autoriser l'utilisateur à fermer l'annonce
            <span className="text-ink-faint text-xs">(sinon la bannière reste affichée en permanence)</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={publish} disabled={loading || !message.trim()} className="bg-brand hover:bg-brand-hover text-white gap-2">
              {editId ? <><Edit className="w-4 h-4" /> Enregistrer les modifications</> : <><Plus className="w-4 h-4" /> Publier</>}
            </Button>
            {editId && (
              <Button variant="outline" className="border-line text-ink" onClick={resetForm} disabled={loading}>
                Annuler
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {items.length === 0 && <p className="text-ink-muted text-sm">Aucune annonce.</p>}
          {items.map((a) => {
            const st = annStatus(a)
            const aud = a.audience || "all"
            const audLabel = aud === "all"
              ? "Tout le monde"
              : aud === "group"
                ? `Groupe : ${groups.find((g) => g.id === a.group_id)?.nom || "?"}`
                : `${(a.user_ids || []).length} utilisateur(s)`
            return (
            <div key={a.id} className="flex items-center gap-3 border border-line rounded-md p-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor[a.level]}`}>{a.level}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-surface-muted text-ink" title="Destinataires">{audLabel}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.dismissible === false ? "bg-red-100 text-red-700" : "bg-surface-muted text-ink-muted"}`} title="Fermeture par l'utilisateur">
                {a.dismissible === false ? "non fermable" : "fermable"}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm block truncate ${a.active ? "text-ink" : "text-ink-faint line-through"}`}>{a.message}</span>
                {(a.start_date || a.end_date) && (
                  <span className="text-xs text-ink-faint">
                    {a.start_date ? `du ${fmtDate(a.start_date)}` : "dès maintenant"} {a.end_date ? `au ${fmtDate(a.end_date)}` : "sans fin"}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" className="border-line text-ink" onClick={() => startEdit(a)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="border-line text-ink" onClick={() => toggle(a.id)}>
                {a.active ? "Désactiver" : "Activer"}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => remove(a.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )})}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Panneau : Statistiques d'usage
// ---------------------------------------------------------------------------
function StatsPanel({ applications, users }: { applications: Application[]; users: User[] }) {
  const [data, setData] = useState<{ totalOpens: number; topApps: any[]; topUsers: any[]; firstOpen?: string | null; lastOpen?: string | null } | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [userId, setUserId] = useState("all")
  const [dismissals, setDismissals] = useState<{ id: string; message: string; count: number; users: any[] }[]>([])
  useEffect(() => {
    fetch("/api/admin/announcement-dismissals").then((r) => r.ok ? r.json() : null).then((d) => setDismissals(d?.announcements || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    if (startDate) p.append("startDate", startDate)
    if (endDate) p.append("endDate", endDate)
    if (userId && userId !== "all") p.append("userId", userId)
    fetch(`/api/admin/stats?${p.toString()}`).then((r) => r.ok ? r.json() : null).then(setData).catch(() => {})
  }, [startDate, endDate, userId])

  const maxApp = Math.max(1, ...(data?.topApps || []).map((a) => a.count))

  const userLabel = userId === "all" ? "Tous" : (users.find((u) => String(u.id) === userId)?.nom || userId)
  // Période toujours datée : bornes des filtres, sinon dates réelles des données, sinon date du jour.
  const dOnly = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "")
  const startLabel = startDate ? new Date(startDate).toLocaleDateString("fr-FR") : (dOnly(data?.firstOpen) || new Date().toLocaleDateString("fr-FR"))
  const endLabel = endDate ? new Date(endDate).toLocaleDateString("fr-FR") : (dOnly(data?.lastOpen) || new Date().toLocaleDateString("fr-FR"))
  // "du … au …" (police PDF standard sans glyphe de flèche)
  const periodLabel = `du ${startLabel} au ${endLabel}`

  // Export Excel : téléchargement direct depuis le serveur (respecte les filtres)
  const exportExcel = () => {
    const p = new URLSearchParams()
    if (startDate) p.append("startDate", startDate)
    if (endDate) p.append("endDate", endDate)
    if (userId !== "all") p.append("userId", userId)
    window.location.href = `/api/admin/stats/export?${p.toString()}`
  }

  // Charge le logo de l'application en data URL (pour l'intégrer au PDF)
  const loadLogo = async (): Promise<{ dataUrl: string; w: number; h: number } | null> => {
    try {
      const res = await fetch("/monetique-logo.png")
      const blob = await res.blob()
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = reject
        r.readAsDataURL(blob)
      })
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new window.Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => resolve({ w: 588, h: 258 })
        img.src = dataUrl
      })
      return { dataUrl, w: dims.w, h: dims.h }
    } catch {
      return null
    }
  }

  // Export PDF : généré côté navigateur (jsPDF) → vrai fichier .pdf
  const exportPdf = async () => {
    if (!data) return
    const { jsPDF } = await import("jspdf")
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF({ unit: "pt", format: "a4" })
    const W = doc.internal.pageSize.getWidth()
    const teal: [number, number, number] = [28, 140, 173]
    const ink: [number, number, number] = [28, 43, 54]

    // En-tête : fond blanc, texte noir, logo de l'application
    const logo = await loadLogo()
    if (logo) {
      const logoH = 34
      const logoW = (logo.w / logo.h) * logoH
      doc.addImage(logo.dataUrl, "PNG", 32, 22, logoW, logoH)
    }
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(16)
    doc.text("Rapport de statistiques d'usage", W - 32, 34, { align: "right" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(10)
    doc.text("Monétique Tunisie", W - 32, 50, { align: "right" })
    doc.setFontSize(9); doc.setTextColor(90, 90, 90)
    doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, W - 32, 64, { align: "right" })
    // Filet de séparation sous l'en-tête
    doc.setDrawColor(...teal); doc.setLineWidth(1.5); doc.line(32, 78, W - 32, 78); doc.setLineWidth(1)

    // Filtres
    doc.setTextColor(...ink); doc.setFontSize(10)
    doc.text(`Période : ${periodLabel}      Utilisateur : ${userLabel}`, 32, 100)

    // KPI
    const kpis = [
      [String(data.totalOpens), "Ouvertures totales"],
      [String(data.topApps.length), "Applications utilisées"],
      [String(data.topUsers.length), "Utilisateurs actifs"],
    ]
    let x = 32
    const bw = (W - 64 - 24) / 3
    kpis.forEach(([n, l]) => {
      doc.setDrawColor(220); doc.roundedRect(x, 112, bw, 54, 8, 8, "S")
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...ink); doc.text(n, x + 14, 140)
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 120, 130); doc.text(l, x + 14, 156)
      x += bw + 12
    })

    // Applications les plus ouvertes (barres)
    let y = 196
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Applications les plus ouvertes", 32, y)
    y += 16
    const barMax = Math.max(1, ...data.topApps.map((a: any) => a.count))
    const barX = 150, barMaxW = W - 150 - 70
    data.topApps.forEach((a: any) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...ink)
      doc.text(String(a.nom).slice(0, 22), 32, y + 9)
      doc.setFillColor(238, 241, 243); doc.roundedRect(barX, y, barMaxW, 12, 6, 6, "F")
      doc.setFillColor(...teal); doc.roundedRect(barX, y, Math.max(6, (a.count / barMax) * barMaxW), 12, 6, 6, "F")
      doc.setFont("helvetica", "bold"); doc.text(String(a.count), W - 32, y + 9, { align: "right" })
      y += 22
    })

    // Utilisateurs les plus actifs (tableau)
    y += 14
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Utilisateurs les plus actifs", 32, y)
    autoTable(doc, {
      startY: y + 8,
      head: [["Rang", "Utilisateur", "Ouvertures"]],
      body: data.topUsers.map((u: any, i: number) => [String(i + 1), u.nom, String(u.count)]),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: teal, halign: "left" },
      columnStyles: { 2: { halign: "right" } },
      margin: { left: 32, right: 32 },
    })

    // Pied de page ancré en BAS de page (et non sous le tableau)
    const H = doc.internal.pageSize.getHeight()
    const footY = H - 40
    doc.setDrawColor(230); doc.line(32, footY - 14, W - 32, footY - 14)
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(140, 150, 160)
    doc.text("Monétique Tunisie - Rapport confidentiel", 32, footY)
    doc.text("Page 1 / 1", W - 32, footY, { align: "right" })

    doc.save("statistiques-usage.pdf")
  }

  return (
    <div className="space-y-6">
      <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <CardTitle className="text-ink flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Statistiques d'usage</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="border-line text-ink hover:bg-app" onClick={exportExcel} disabled={!data}>
                <Download className="w-4 h-4 mr-2" /> Exporter Excel
              </Button>
              <Button variant="outline" className="border-line text-ink hover:bg-app" onClick={exportPdf} disabled={!data}>
                <Download className="w-4 h-4 mr-2" /> Exporter PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-ink font-medium">Utilisateur</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-ink font-medium">Du</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
            </div>
            <div>
              <Label className="text-ink font-medium">Au</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
            </div>
            <div className="flex items-end">
              {(startDate || endDate || userId !== "all") && (
                <Button variant="outline" className="border-line text-ink" onClick={() => { setStartDate(""); setEndDate(""); setUserId("all") }}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          <div className="text-sm text-ink-muted">Total d'ouvertures d'applications : <strong className="text-ink">{data?.totalOpens ?? 0}</strong></div>

          <div>
            <h4 className="font-semibold text-ink mb-3">Applications les plus ouvertes</h4>
            {(!data || data.topApps.length === 0) ? (
              <p className="text-ink-muted text-sm">Aucune donnée pour le moment (les ouvertures sont enregistrées quand un utilisateur clique sur une application).</p>
            ) : (
              <div className="space-y-2">
                {data.topApps.map((a) => (
                  <div key={a.appId} className="flex items-center gap-3">
                    <span className="w-40 truncate text-sm text-ink">{a.nom}</span>
                    <div className="flex-1 bg-surface-muted rounded-full h-3 overflow-hidden">
                      <div className="bg-brand h-3 rounded-full" style={{ width: `${(a.count / maxApp) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm font-medium text-ink">{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-ink mb-3">Utilisateurs les plus actifs</h4>
            {(!data || data.topUsers.length === 0) ? (
              <p className="text-ink-muted text-sm">Aucune donnée pour le moment.</p>
            ) : (
              <div className="space-y-1">
                {data.topUsers.map((u) => (
                  <div key={u.userId} className="flex justify-between text-sm border-b border-line py-1">
                    <span className="text-ink">{u.nom}</span>
                    <span className="font-medium text-ink">{u.count} ouverture(s)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fermetures d'annonces (uniquement pour les annonces fermables) */}
      <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2"><Megaphone className="w-5 h-5" /> Fermetures d'annonces</CardTitle>
          <p className="text-sm text-ink-muted">Utilisateurs ayant fermé chaque annonce (seules les annonces fermables sont listées).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {dismissals.length === 0 ? (
            <p className="text-ink-muted text-sm">Aucune annonce fermable.</p>
          ) : (
            dismissals.map((a) => (
              <div key={a.id} className="border border-line rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-ink flex-1 truncate">{a.message}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-muted text-ink font-semibold">{a.count} fermeture(s)</span>
                </div>
                {a.users.length === 0 ? (
                  <p className="text-xs text-ink-faint">Personne ne l'a fermée.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {a.users.map((u: any) => (
                      <span key={u.id} className="text-xs px-2 py-0.5 rounded-full bg-surface-muted text-ink" title={new Date(u.at).toLocaleString("fr-FR")}>
                        {u.nom}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panneau : Groupes d'accès (accorder un lot d'apps à un groupe d'utilisateurs)
// ---------------------------------------------------------------------------
interface Grp { id: string; nom: string; member_ids: number[]; created_at: string }

function GroupsPanel({ users, applications, onApplied }: { users: User[]; applications: Application[]; onApplied: () => void }) {
  const standardUsers = users.filter((u) => u.role !== "admin")
  const toggle = (arr: number[], set: (v: number[]) => void, id: number) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

  // --- Groupes persistants ---
  const [groups, setGroups] = useState<Grp[]>([])
  const [newName, setNewName] = useState("")
  const [newMembers, setNewMembers] = useState<number[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editMembers, setEditMembers] = useState<number[]>([])
  const [viewAccessId, setViewAccessId] = useState<string | null>(null)
  const [accessList, setAccessList] = useState<{ utilisateur_id: number; application_id: number }[]>([])

  const loadGroups = async () => {
    try {
      const res = await fetch("/api/admin/groups")
      if (res.ok) setGroups((await res.json()).groups || [])
    } catch { /* silencieux */ }
  }
  const loadAccess = async () => {
    try {
      const res = await fetch("/api/admin/user-access")
      if (res.ok) setAccessList(await res.json())
    } catch { /* silencieux */ }
  }
  useEffect(() => { loadGroups(); loadAccess() }, [])

  // Applications auxquelles un utilisateur a accès (noms)
  const userApps = (userId: number) =>
    accessList
      .filter((a) => a.utilisateur_id === userId)
      .map((a) => applications.find((app) => app.id === a.application_id)?.nom)
      .filter(Boolean) as string[]

  const createGroup = async () => {
    if (!newName.trim()) return
    const res = await fetch("/api/admin/groups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: newName, member_ids: newMembers }),
    })
    if (res.ok) { setNewName(""); setNewMembers([]); await loadGroups() }
  }
  const saveMembers = async (id: string) => {
    const res = await fetch("/api/admin/groups", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, member_ids: editMembers }),
    })
    if (res.ok) { setEditId(null); await loadGroups() }
  }
  const removeGroup = async (id: string) => {
    if (!confirm("Supprimer ce groupe ? (les accès déjà accordés ne sont pas retirés)")) return
    await fetch(`/api/admin/groups?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    await loadGroups()
  }

  // --- Octroi / révocation d'accès ---
  const [targetMode, setTargetMode] = useState<"group" | "manual">("manual")
  const [targetGroup, setTargetGroup] = useState<string>("")
  const [selUsers, setSelUsers] = useState<number[]>([])
  const [selApps, setSelApps] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")

  const effectiveUsers = targetMode === "group"
    ? (groups.find((g) => g.id === targetGroup)?.member_ids || [])
    : selUsers

  const apply = async (action: "grant" | "revoke") => {
    if (effectiveUsers.length === 0 || selApps.length === 0) return
    setLoading(true); setResult("")
    try {
      const res = await fetch("/api/admin/access-bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: effectiveUsers, application_ids: selApps, action }),
      })
      const data = await res.json()
      if (res.ok) { setResult(`${data.changed} accès ${action === "grant" ? "accordé(s)" : "révoqué(s)"}.`); onApplied(); await loadAccess() }
      else setResult(data.error || "Erreur.")
    } finally { setLoading(false) }
  }

  const nameOf = (id: number) => users.find((u) => u.id === id)?.nom || `#${id}`

  return (
    <div className="space-y-6">
      {/* Gestion des groupes d'utilisateurs */}
      <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2"><Users className="w-5 h-5" /> Groupes d'utilisateurs</CardTitle>
          <p className="text-sm text-ink-muted">Créez des groupes nommés d'utilisateurs pour leur accorder des accès en une fois.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Créer un groupe */}
          <div className="space-y-3 border border-line rounded-md p-3">
            <Label className="text-ink font-medium">Nouveau groupe</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du groupe (ex. Équipe RH)" className="bg-surface border-line text-ink" />
            <div>
              <p className="text-sm text-ink-muted mb-1">Membres :</p>
              <div className="space-y-1 max-h-40 overflow-auto border border-line rounded-md p-2">
                {standardUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer py-1">
                    <input type="checkbox" checked={newMembers.includes(u.id)} onChange={() => toggle(newMembers, setNewMembers, u.id)} />
                    {u.nom} <span className="text-ink-faint">({u.email})</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={createGroup} disabled={!newName.trim()} className="bg-brand hover:bg-brand-hover text-white gap-2">
              <Plus className="w-4 h-4" /> Créer le groupe
            </Button>
          </div>

          {/* Liste des groupes */}
          <div className="space-y-2">
            {groups.length === 0 && <p className="text-ink-muted text-sm">Aucun groupe.</p>}
            {groups.map((g) => (
              <div key={g.id} className="border border-line rounded-md p-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink flex-1">{g.nom} <span className="text-ink-faint text-sm">· {g.member_ids.length} membre(s)</span></span>
                  <Button variant="outline" size="sm" className="border-line text-ink" onClick={() => { setViewAccessId(viewAccessId === g.id ? null : g.id); loadAccess() }}>
                    {viewAccessId === g.id ? "Masquer les accès" : "Voir les accès"}
                  </Button>
                  <Button variant="outline" size="sm" className="border-line text-ink" onClick={() => { setEditId(editId === g.id ? null : g.id); setEditMembers(g.member_ids) }}>
                    {editId === g.id ? "Fermer" : "Membres"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeGroup(g.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {g.member_ids.length > 0 && editId !== g.id && viewAccessId !== g.id && (
                  <p className="text-xs text-ink-faint mt-1">{g.member_ids.map(nameOf).join(", ")}</p>
                )}
                {/* Accès de chaque membre du groupe */}
                {viewAccessId === g.id && (
                  <div className="mt-3 space-y-2">
                    {g.member_ids.length === 0 && <p className="text-ink-muted text-sm">Ce groupe n'a aucun membre.</p>}
                    {g.member_ids.map((mid) => {
                      const apps = userApps(mid)
                      const u = users.find((x) => x.id === mid)
                      return (
                        <div key={mid} className="border border-line rounded-md p-2">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={u?.nom || `#${mid}`} avatar={u?.avatar} size={24} />
                            <span className="text-sm font-medium text-ink">{u?.nom || `#${mid}`}</span>
                            {u?.email && <span className="text-xs text-ink-faint">({u.email})</span>}
                            <span className="ml-auto text-xs text-ink-faint">{apps.length} application(s)</span>
                          </div>
                          {apps.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {apps.map((n) => (
                                <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-surface-muted text-ink">{n}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-ink-faint mt-1">Aucun accès.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {editId === g.id && (
                  <div className="mt-3 space-y-2">
                    <div className="space-y-1 max-h-40 overflow-auto border border-line rounded-md p-2">
                      {standardUsers.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer py-1">
                          <input type="checkbox" checked={editMembers.includes(u.id)} onChange={() => toggle(editMembers, setEditMembers, u.id)} />
                          {u.nom} <span className="text-ink-faint">({u.email})</span>
                        </label>
                      ))}
                    </div>
                    <Button size="sm" onClick={() => saveMembers(g.id)} className="bg-brand hover:bg-brand-hover text-white">Enregistrer les membres</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Octroi / révocation d'accès */}
      <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2"><Layers className="w-5 h-5" /> Octroyer / révoquer des accès</CardTitle>
          <p className="text-sm text-ink-muted">Choisissez la cible (un groupe ou une sélection manuelle) et les applications, puis accordez ou révoquez en une opération. Les accès restent individuels et additifs.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <select value={targetMode} onChange={(e) => setTargetMode(e.target.value as any)} className="border border-line rounded-md bg-surface text-ink px-3 h-10">
              <option value="manual">Sélection manuelle</option>
              <option value="group">Un groupe</option>
            </select>
            {targetMode === "group" && (
              <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} className="border border-line rounded-md bg-surface text-ink px-3 h-10">
                <option value="">— choisir un groupe —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.member_ids.length})</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-ink mb-2">Applications</h4>
              <div className="space-y-1 max-h-64 overflow-auto border border-line rounded-md p-2">
                {applications.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer py-1">
                    <input type="checkbox" checked={selApps.includes(a.id)} onChange={() => toggle(selApps, setSelApps, a.id)} />
                    {a.nom}{a.category ? <span className="text-ink-faint"> · {a.category}</span> : null}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-ink mb-2">{targetMode === "group" ? "Membres du groupe" : "Utilisateurs"}</h4>
              {targetMode === "group" ? (
                <div className="border border-line rounded-md p-2 max-h-64 overflow-auto text-sm text-ink">
                  {effectiveUsers.length === 0 ? <p className="text-ink-muted">Sélectionnez un groupe.</p> : effectiveUsers.map((id) => <div key={id} className="py-1">{nameOf(id)}</div>)}
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-auto border border-line rounded-md p-2">
                  {standardUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer py-1">
                      <input type="checkbox" checked={selUsers.includes(u.id)} onChange={() => toggle(selUsers, setSelUsers, u.id)} />
                      {u.nom} <span className="text-ink-faint">({u.email})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {result && <p className="text-sm text-ink-muted">{result}</p>}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => apply("grant")} disabled={loading || effectiveUsers.length === 0 || selApps.length === 0} className="bg-brand hover:bg-brand-hover text-white">
              Accorder l'accès ({selApps.length} app × {effectiveUsers.length} utilisateur)
            </Button>
            <Button onClick={() => apply("revoke")} disabled={loading || effectiveUsers.length === 0 || selApps.length === 0} variant="outline" className="border-line text-ink">
              Révoquer l'accès
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panneau : Activité d'un utilisateur (historique complet, sans limite de 48h)
// ---------------------------------------------------------------------------
function UserActivityPanel({ users, initialUserId }: { users: User[]; initialUserId?: string }) {
  const [userId, setUserId] = useState<string>(initialUserId || "all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [data, setData] = useState<{ usedApps: any[]; modifications: any[]; modificationsTotal: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const PAGE_SIZE = 10
  const isAll = userId === "all"

  useEffect(() => { if (initialUserId) setUserId(initialUserId) }, [initialUserId])
  // Revenir à la première page + vider la sélection quand la cible/les dates changent
  useEffect(() => { setPage(0); setSelectedIds([]) }, [userId, startDate, endDate])
  useEffect(() => { setSelectedIds([]) }, [page])

  const load = () => {
    if (!userId) { setData(null); return }
    setLoading(true)
    const p = new URLSearchParams({ userId, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
    if (startDate) p.append("startDate", startDate)
    if (endDate) p.append("endDate", endDate)
    fetch(`/api/admin/user-activity?${p.toString()}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [userId, startDate, endDate, page])

  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"
  const selectedUser = users.find((u) => String(u.id) === userId)

  const deleteIds = async (ids: string[], label: string) => {
    if (ids.length === 0) return
    if (!confirm(`Supprimer ${label} ?`)) return
    await fetch("/api/admin/user-activity", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setSelectedIds([])
    load()
  }

  // Sélection multiple : chaque application regroupe plusieurs ids de logs.
  const toggleIds = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allIn = ids.every((id) => prev.includes(id))
      return allIn ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    })
  }
  const isSelected = (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.includes(id))
  // Tous les ids visibles sur la page (apps affichées + modifications de la page)
  const shownIds: string[] = data
    ? [...data.usedApps.flatMap((a: any) => a.ids), ...data.modifications.map((m: any) => m.id)]
    : []
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedIds.includes(id))
  const toggleSelectAllShown = () => {
    setSelectedIds((prev) => allShownSelected ? prev.filter((id) => !shownIds.includes(id)) : Array.from(new Set([...prev, ...shownIds])))
  }
  const deleteSelected = () => deleteIds(selectedIds, `les ${selectedIds.length} ligne(s) sélectionnée(s)`)
  const deleteAll = async () => {
    if (!userId) return
    const who = isAll ? "de TOUS les utilisateurs" : "de cet utilisateur"
    const scope = startDate || endDate ? `l'activité affichée ${who} (filtre de dates appliqué)` : `TOUTE l'activité ${who}`
    if (!confirm(`Supprimer ${scope} ? Action irréversible.`)) return
    await fetch("/api/admin/user-activity", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: isAll ? "all" : Number(userId), all: true, startDate: startDate || undefined, endDate: endDate || undefined }),
    })
    setPage(0)
    load()
  }

  return (
    <Card className="bg-surface border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]">
      <CardHeader>
        <CardTitle className="text-ink flex items-center gap-2"><User className="w-5 h-5" /> Activité d'un utilisateur</CardTitle>
        <p className="text-sm text-ink-muted">Historique complet : applications utilisées et modifications du compte.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtres */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-ink font-medium">Utilisateur</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.nom} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-ink font-medium">Du</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
          </div>
          <div>
            <Label className="text-ink font-medium">Au</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex items-end gap-2">
            {(startDate || endDate) && (
              <Button variant="outline" className="border-line text-ink" onClick={() => { setStartDate(""); setEndDate("") }}>
                Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {!userId ? (
          <p className="text-ink-muted text-sm">Sélectionnez un utilisateur pour voir son activité.</p>
        ) : loading ? (
          <p className="text-ink-muted text-sm">Chargement…</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {isAll ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand"><Users className="w-5 h-5" /></div>
                  <p className="font-medium text-ink">Tous les utilisateurs</p>
                </div>
              ) : selectedUser ? (
                <>
                  <UserAvatar name={selectedUser.nom} avatar={selectedUser.avatar} size={40} />
                  <div className="flex-1">
                    <p className="font-medium text-ink">{selectedUser.nom}</p>
                    <p className="text-sm text-ink-muted">{selectedUser.email}</p>
                  </div>
                </>
              ) : null}
              <div className="flex-1" />
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={deleteSelected}
                disabled={selectedIds.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer la sélection ({selectedIds.length})
              </Button>
              <Button
                variant="outline"
                className="border-red-400 text-red-700 hover:bg-red-50"
                onClick={deleteAll}
                disabled={!data || (data.usedApps.length === 0 && data.modificationsTotal === 0)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {startDate || endDate ? "Supprimer l'activité affichée" : "Supprimer toute l'activité"}
              </Button>
            </div>

            {data && (data.usedApps.length > 0 || data.modificationsTotal > 0) && (
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                <input type="checkbox" checked={allShownSelected} onChange={toggleSelectAllShown} />
                Tout sélectionner sur cette page
              </label>
            )}

            <div>
              <h4 className="font-semibold text-ink mb-2">Applications utilisées</h4>
              {!data || data.usedApps.length === 0 ? (
                <p className="text-ink-muted text-sm">Aucune ouverture d'application enregistrée.</p>
              ) : (
                <ul className="space-y-1">
                  {data.usedApps.map((a) => (
                    <li key={a.appId} className="flex items-center justify-between gap-3 text-sm border-b border-line py-1.5">
                      <input type="checkbox" checked={isSelected(a.ids)} onChange={() => toggleIds(a.ids)}
                        aria-label={`Sélectionner ${a.nom}`} />
                      <span className="text-ink flex-1">{a.nom}</span>
                      <span className="text-ink-muted text-xs">{a.count} ouverture(s) · dernière {fmt(a.last)}</span>
                      <button type="button" onClick={() => deleteIds(a.ids, `les ${a.count} ouverture(s) de « ${a.nom} »`)}
                        aria-label="Supprimer" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-ink mb-2">
                Modifications du compte
                {data && data.modificationsTotal > 0 && <span className="text-ink-faint font-normal text-sm"> · {data.modificationsTotal}</span>}
              </h4>
              {!data || data.modificationsTotal === 0 ? (
                <p className="text-ink-muted text-sm">Aucune modification enregistrée.</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {data.modifications.map((m: any) => (
                      <li key={m.id} className="flex items-start justify-between gap-3 text-sm border-b border-line py-1.5">
                        <input type="checkbox" className="mt-1" checked={selectedIds.includes(m.id)} onChange={() => toggleIds([m.id])}
                          aria-label="Sélectionner cette ligne" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-ink">{m.action}</span>
                            {isAll && m.userName && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-muted text-ink">{m.userName}</span>}
                            <span className="text-ink-faint text-xs">{fmt(m.timestamp)}</span>
                          </div>
                          {m.details && <p className="text-xs text-ink-muted">{m.details}</p>}
                        </div>
                        <button type="button" onClick={() => deleteIds([m.id], "cette ligne")}
                          aria-label="Supprimer" className="text-red-600 hover:text-red-700 mt-0.5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {/* Pagination des modifications */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      Page {page + 1} / {Math.max(1, Math.ceil(data.modificationsTotal / PAGE_SIZE))}
                    </span>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm" className="border-line text-ink" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                        Précédent
                      </Button>
                      <Button variant="outline" size="sm" className="border-line text-ink" disabled={(page + 1) * PAGE_SIZE >= data.modificationsTotal} onClick={() => setPage((p) => p + 1)}>
                        Suivant
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
