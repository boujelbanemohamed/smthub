"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogOut, Settings, User, KeyRound, Eye, EyeOff, Copy, Trash2, Plus, Pencil, X, Star, Search, BarChart3 } from "lucide-react"
import { PageLoader } from "@/components/loading-spinner"
import { AppAvatar } from "@/components/ui/app-avatar"
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

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
  category?: string
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [showWelcome, setShowWelcome] = useState(true)
  const router = useRouter()

  // La bannière de bienvenue disparaît automatiquement après 2 minutes.
  useEffect(() => {
    if (!showWelcome) return
    const timer = setTimeout(() => setShowWelcome(false), 2 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [showWelcome])

  // Recherche + favoris
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState<string>("")
  const [favIds, setFavIds] = useState<number[]>([])

  // Annonces (bannières publiées par l'admin). La fermeture est enregistrée
  // côté serveur (par compte) ; on masque aussi immédiatement en local.
  const [announcements, setAnnouncements] = useState<{ id: string; message: string; level: string; dismissible?: boolean }[]>([])
  const [dismissedAnn, setDismissedAnn] = useState<string[]>([])

  // Présence (admin) : utilisateurs connectés / non connectés
  const [presence, setPresence] = useState<{ connected: any[]; disconnected: any[] } | null>(null)
  const loadPresence = async () => {
    try {
      const res = await fetch("/api/presence")
      if (res.ok) setPresence(await res.json())
    } catch { /* silencieux */ }
  }

  // Détail d'activité d'un utilisateur (admin) : apps utilisées + modifications
  const [activityUser, setActivityUser] = useState<any | null>(null)
  const [activity, setActivity] = useState<{ usedApps: any[]; modifications: any[] } | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const openUserActivity = async (u: any) => {
    setActivityUser(u)
    setActivity(null)
    setActivityLoading(true)
    try {
      // Le popup ne montre que les dernières 48 h ; l'historique complet est
      // consultable dans la section dédiée de l'admin.
      const res = await fetch(`/api/admin/user-activity?userId=${u.id}&hours=48`)
      if (res.ok) setActivity(await res.json())
    } catch { /* silencieux */ } finally {
      setActivityLoading(false)
    }
  }
  const fmtDT = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"

  // Top 5 des applications les plus utilisées (personnel pour l'utilisateur,
  // global tous utilisateurs pour l'admin).
  const [topApps, setTopApps] = useState<{ scope: string; top: any[] } | null>(null)
  const loadTopApps = async () => {
    try {
      const res = await fetch("/api/top-apps")
      if (res.ok) setTopApps(await res.json())
    } catch { /* silencieux */ }
  }

  const loadAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements")
      if (res.ok) {
        const data = await res.json()
        setAnnouncements(data.announcements || [])
      }
    } catch {
      /* silencieux */
    }
  }

  // Ferme une annonce : masquage immédiat + enregistrement serveur (par compte).
  const dismissAnnouncement = (id: string) => {
    setDismissedAnn((prev) => Array.from(new Set([...prev, id])))
    fetch("/api/announcements/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const loadFavorites = async () => {
    try {
      const res = await fetch("/api/app-favorites")
      if (res.ok) {
        const data = await res.json()
        setFavIds(data.appIds || [])
      }
    } catch {
      /* silencieux */
    }
  }

  const toggleFavorite = async (appId: number) => {
    // maj optimiste
    setFavIds((prev) => (prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]))
    try {
      await fetch("/api/app-favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: appId }),
      })
    } catch {
      /* en cas d'échec, on recharge l'état réel */
      loadFavorites()
    }
  }

  // Coffre-fort : app_ids ayant un identifiant enregistré + état du dialogue
  const [credAppIds, setCredAppIds] = useState<number[]>([])
  const [credApp, setCredApp] = useState<Application | null>(null)
  const [credMode, setCredMode] = useState<"add" | "view">("add")
  const [credForm, setCredForm] = useState({ login: "", password: "", note: "" })
  const [credLoading, setCredLoading] = useState(false)
  const [credError, setCredError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const loadCredAppIds = async () => {
    try {
      const res = await fetch("/api/app-credentials")
      if (res.ok) {
        const data = await res.json()
        setCredAppIds(data.appIds || [])
      }
    } catch {
      /* silencieux */
    }
  }

  const openAddCredential = (app: Application) => {
    setCredApp(app)
    setCredMode("add")
    setCredForm({ login: "", password: "", note: "" })
    setCredError("")
    setShowPassword(false)
  }

  const openViewCredential = async (app: Application) => {
    setCredApp(app)
    setCredMode("view")
    setCredError("")
    setShowPassword(false)
    setCredLoading(true)
    setCredForm({ login: "", password: "", note: "" })
    try {
      const res = await fetch(`/api/app-credentials?application_id=${app.id}`)
      const data = await res.json()
      if (res.ok) {
        setCredForm({ login: data.login || "", password: data.password || "", note: data.note || "" })
      } else {
        setCredError(data.error || "Impossible de charger l'identifiant.")
      }
    } catch {
      setCredError("Erreur de connexion.")
    } finally {
      setCredLoading(false)
    }
  }

  const openEditCredential = async (app: Application) => {
    setCredApp(app)
    setCredMode("add")
    setCredError("")
    setShowPassword(false)
    setCredLoading(true)
    setCredForm({ login: "", password: "", note: "" })
    try {
      const res = await fetch(`/api/app-credentials?application_id=${app.id}`)
      const data = await res.json()
      if (res.ok) {
        setCredForm({ login: data.login || "", password: data.password || "", note: data.note || "" })
      } else {
        setCredError(data.error || "Impossible de charger l'identifiant.")
      }
    } catch {
      setCredError("Erreur de connexion.")
    } finally {
      setCredLoading(false)
    }
  }

  const saveCredential = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credApp) return
    setCredError("")
    setCredLoading(true)
    try {
      const res = await fetch("/api/app-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: credApp.id, ...credForm }),
      })
      const data = await res.json()
      if (res.ok) {
        setCredAppIds((prev) => (prev.includes(credApp.id) ? prev : [...prev, credApp.id]))
        setCredApp(null)
      } else {
        setCredError(data.error || "Erreur lors de l'enregistrement.")
      }
    } catch {
      setCredError("Erreur de connexion.")
    } finally {
      setCredLoading(false)
    }
  }

  const deleteCredential = async () => {
    if (!credApp) return
    if (!confirm("Supprimer l'identifiant enregistré pour cette application ?")) return
    setCredLoading(true)
    try {
      const res = await fetch(`/api/app-credentials?application_id=${credApp.id}`, { method: "DELETE" })
      if (res.ok) {
        setCredAppIds((prev) => prev.filter((id) => id !== credApp.id))
        setCredApp(null)
      }
    } finally {
      setCredLoading(false)
    }
  }

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

        // Une fois l'utilisateur connu, tous les chargements sont indépendants :
        // on les lance EN PARALLÈLE (au lieu d'une cascade) pour réduire le temps
        // total au plus lent des appels et non à leur somme.
        const isAdmin = authData.user?.role === "admin"
        await Promise.all([
          fetch("/api/user-applications")
            .then((r) => (r.ok ? r.json() : []))
            .then((d) => setApplications(d))
            .catch(() => {}),
          loadCredAppIds(),
          loadFavorites(),
          loadAnnouncements(),
          loadTopApps(),
          isAdmin ? loadPresence() : Promise.resolve(),
        ])
      } catch (error) {
        console.error("Erreur lors du chargement:", error)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Rafraîchit périodiquement les listes de présence pour l'admin
  useEffect(() => {
    if (user?.role !== "admin") return
    const id = setInterval(loadPresence, 60_000)
    return () => clearInterval(id)
  }, [user?.role])

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
    <div className="min-h-screen bg-app">
      {/* Facebook-style Header */}
      <header className="bg-surface border-b border-line shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BrandLogo height={32} />
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <UserAvatar name={user.nom} avatar={user.avatar} size={36} />
                <div className="hidden md:block">
                  <p className="text-ink font-medium">{user.nom}</p>
                  <p className="text-ink-muted text-sm">{user.email}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <Link href="/profile">
                  <Button className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                    <User className="w-4 h-4 mr-2" />
                    Profil
                  </Button>
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md transition-colors duration-200 text-sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Bannière de bienvenue (auto-masquée après 2 min, fermable) */}
        {showWelcome && (
          <div className="relative mb-8 rounded-xl bg-gradient-to-r from-brand to-brand-hover p-6 sm:p-8 shadow-md">
            <h2 className="text-2xl sm:text-3xl font-bold text-white pr-10">
              Bonjour {user.nom}
            </h2>
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              aria-label="Fermer le message de bienvenue"
              className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Annonces publiées par l'administrateur (fermables) */}
        {announcements.filter((a) => !dismissedAnn.includes(a.id)).map((a) => {
          const styles: Record<string, string> = {
            info: "bg-blue-50 border-blue-200 text-blue-800",
            warning: "bg-amber-50 border-amber-200 text-amber-800",
            success: "bg-green-50 border-green-200 text-green-800",
          }
          const canDismiss = a.dismissible !== false
          return (
            <div key={a.id} className={`relative mb-4 rounded-lg border px-4 py-3 text-sm ${canDismiss ? "pr-10" : ""} ${styles[a.level] || styles.info}`}>
              <span className="font-medium">{a.message}</span>
              {canDismiss && (
                <button
                  type="button"
                  onClick={() => dismissAnnouncement(a.id)}
                  aria-label="Fermer l'annonce"
                  className="absolute top-2 right-2 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}

        {/* Statistiques : 5 applications les plus utilisées */}
        {topApps && topApps.top.length > 0 && (() => {
          const max = Math.max(1, ...topApps.top.map((a: any) => a.count))
          return (
            <section className="mb-8 bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-brand" />
                <h3 className="text-lg font-bold text-ink">
                  {topApps.scope === "global" ? "Top 5 des applications les plus utilisées" : "Vos 5 applications les plus utilisées"}
                </h3>
              </div>
              <div className="space-y-2">
                {topApps.top.map((a: any, i: number) => (
                  <div key={a.appId} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-semibold text-ink-muted">{i + 1}</span>
                    <span className="w-40 truncate text-sm text-ink">{a.nom}</span>
                    <div className="flex-1 bg-surface-muted rounded-full h-3 overflow-hidden">
                      <div className="bg-brand h-3 rounded-full" style={{ width: `${(a.count / max) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right text-sm font-medium text-ink">{a.count} ouv.</span>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        {/* Applications Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-ink">Vos applications</h3>
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-surface-muted text-ink-muted text-sm font-semibold">
                {applications.length}
              </span>
            </div>
            {/* Barre de recherche */}
            {applications.length > 0 && (
              <div className="relative sm:ml-auto w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une application…"
                  className="pl-9 bg-surface border-line text-ink"
                />
              </div>
            )}
          </div>

          {/* Filtre par catégorie */}
          {(() => {
            const categories = Array.from(
              new Set(applications.map((a) => (a.category || "").trim()).filter(Boolean))
            ).sort((a, b) => a.localeCompare(b))
            if (categories.length === 0) return null
            const chip = (label: string, value: string) => (
              <button
                key={value || "__all__"}
                type="button"
                onClick={() => setCatFilter(value)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  catFilter === value
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-ink-muted border-line hover:bg-surface-muted"
                }`}
              >
                {label}
              </button>
            )
            return (
              <div className="flex flex-wrap gap-2 mb-4">
                {chip("Toutes", "")}
                {categories.map((c) => chip(c, c))}
              </div>
            )
          })()}

          {applications.length > 0 ? (() => {
            // Filtre (recherche + catégorie) puis tri : favoris d'abord, ensuite ordre d'affichage.
            const visible = applications
              .filter((app) => app.nom.toLowerCase().includes(search.trim().toLowerCase()))
              .filter((app) => !catFilter || (app.category || "").trim() === catFilter)
              .sort((a, b) => {
                const fa = favIds.includes(a.id) ? 0 : 1
                const fb = favIds.includes(b.id) ? 0 : 1
                if (fa !== fb) return fa - fb
                return a.ordre_affichage - b.ordre_affichage
              })
            if (visible.length === 0) {
              return <p className="text-ink-muted text-sm">Aucune application ne correspond à votre recherche.</p>
            }
            return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {visible.map((app) => {
                const hasCred = credAppIds.includes(app.id)
                const isFav = favIds.includes(app.id)
                return (
                  <div
                    key={app.id}
                    className="relative bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-4 text-center flex flex-col hover:shadow-lg transition-all duration-200"
                  >
                    {/* Favori */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(app.id)}
                      aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      className="absolute top-2 right-2 text-ink-faint hover:text-yellow-500 transition-colors duration-200"
                    >
                      <Star className={`w-4 h-4 ${isFav ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    </button>
                    <Link
                      href={app.app_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex-1"
                      onClick={() => {
                        // Journalise l'ouverture (base des statistiques d'usage) — sans bloquer la navigation
                        fetch("/api/app-open", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ application_id: app.id, nom: app.nom }),
                          keepalive: true,
                        }).catch(() => {})
                      }}
                    >
                      <div className="flex justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                        <AppAvatar app={app} size={64} />
                      </div>
                      <h3 className="font-medium text-ink text-sm line-clamp-2 group-hover:text-brand transition-colors duration-200">
                        {app.nom}
                      </h3>
                      {(app.category || "").trim() ? (
                        <span className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                          {app.category}
                        </span>
                      ) : null}
                    </Link>

                    {/* Bouton coffre-fort d'identifiants */}
                    {hasCred ? (
                      <div className="mt-3 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => openViewCredential(app)}
                          className="inline-flex items-center justify-center gap-1 w-full text-xs font-medium text-brand border border-brand rounded-md py-1.5 hover:bg-brand hover:text-white transition-colors duration-200"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Voir login
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCredential(app)}
                          className="inline-flex items-center justify-center gap-1 w-full text-xs font-medium text-ink-muted border border-line rounded-md py-1.5 hover:bg-surface-muted transition-colors duration-200"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Modifier login
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAddCredential(app)}
                        className="mt-3 inline-flex items-center justify-center gap-1 w-full text-xs font-medium text-ink-muted border border-line rounded-md py-1.5 hover:bg-surface-muted transition-colors duration-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter login
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            )
          })() : (
            <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-12 text-center">
              <div className="w-16 h-16 bg-app rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-xl font-semibold text-ink mb-2">Aucune application disponible</h3>
              <p className="text-ink-muted">Contactez votre administrateur pour obtenir l'accès aux applications.</p>
            </div>
          )}
        </section>

        {/* Admin : utilisateurs connectés / non connectés */}
        {user.role === "admin" && presence && (
          <section className="mt-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Connectés */}
              <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                  <h3 className="text-lg font-bold text-ink">Utilisateurs connectés</h3>
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                    {presence.connected.length}
                  </span>
                </div>
                {presence.connected.length === 0 ? (
                  <p className="text-ink-muted text-sm">Aucun utilisateur connecté.</p>
                ) : (
                  <ul className="space-y-1 max-h-80 overflow-auto">
                    {presence.connected.map((u) => (
                      <li key={u.id}>
                        <button type="button" onClick={() => openUserActivity(u)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-app transition-colors text-left">
                          <UserAvatar name={u.nom} avatar={u.avatar} size={32} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{u.nom}</p>
                            <p className="text-xs text-ink-muted truncate">{u.email}</p>
                          </div>
                          <span className="ml-auto text-xs text-green-600 font-medium whitespace-nowrap">en ligne</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Non connectés */}
              <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <h3 className="text-lg font-bold text-ink">Utilisateurs non connectés</h3>
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-surface-muted text-ink-muted text-sm font-semibold">
                    {presence.disconnected.length}
                  </span>
                </div>
                {presence.disconnected.length === 0 ? (
                  <p className="text-ink-muted text-sm">Tout le monde est connecté.</p>
                ) : (
                  <ul className="space-y-1 max-h-80 overflow-auto">
                    {presence.disconnected.map((u) => (
                      <li key={u.id}>
                        <button type="button" onClick={() => openUserActivity(u)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-app transition-colors text-left">
                          <UserAvatar name={u.nom} avatar={u.avatar} size={32} className="opacity-60" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{u.nom}</p>
                            <p className="text-xs text-ink-muted truncate">{u.email}</p>
                          </div>
                          <span className="ml-auto text-xs text-ink-faint whitespace-nowrap text-right">
                            {u.last_login ? <>Dernière connexion<br />{fmtDT(u.last_login)}</> : "Jamais connecté"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Détail d'activité d'un utilisateur (admin) */}
      {activityUser && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={() => setActivityUser(null)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-auto rounded-lg bg-surface border border-line shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setActivityUser(null)} aria-label="Fermer"
              className="absolute top-3 right-3 text-ink-faint hover:text-ink transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <UserAvatar name={activityUser.nom} avatar={activityUser.avatar} size={44} />
              <div>
                <h2 className="text-lg font-semibold text-ink">{activityUser.nom}</h2>
                <p className="text-sm text-ink-muted">{activityUser.email}</p>
                {activityUser.last_login && (
                  <p className="text-xs text-ink-faint">Dernière connexion : {fmtDT(activityUser.last_login)}</p>
                )}
              </div>
            </div>

            <p className="text-xs font-medium text-white mb-3 bg-red-600 rounded-md px-3 py-1.5">
              Activité des dernières 48 heures.
            </p>

            {activityLoading ? (
              <p className="text-ink-muted text-sm py-6 text-center">Chargement…</p>
            ) : (
              <div className="space-y-6">
                {/* Applications utilisées */}
                <div>
                  <h3 className="font-semibold text-ink mb-2">Applications utilisées</h3>
                  {!activity || activity.usedApps.length === 0 ? (
                    <p className="text-ink-muted text-sm">Aucune ouverture d'application enregistrée.</p>
                  ) : (
                    <ul className="space-y-1">
                      {activity.usedApps.map((a) => (
                        <li key={a.appId} className="flex items-center justify-between text-sm border-b border-line py-1.5">
                          <span className="text-ink">{a.nom}</span>
                          <span className="text-ink-muted text-xs">{a.count} ouverture(s) · dernière {fmtDT(a.last)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Modifications apportées */}
                <div>
                  <h3 className="font-semibold text-ink mb-2">Modifications du compte</h3>
                  {!activity || activity.modifications.length === 0 ? (
                    <p className="text-ink-muted text-sm">Aucune modification enregistrée.</p>
                  ) : (
                    <ul className="space-y-1">
                      {activity.modifications.map((m, i) => (
                        <li key={i} className="text-sm border-b border-line py-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-ink">{m.action}</span>
                            <span className="text-ink-faint text-xs">{fmtDT(m.timestamp)}</span>
                          </div>
                          {m.details && <p className="text-xs text-ink-muted">{m.details}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Redirection vers l'historique complet dans l'admin */}
                <div className="pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin?activity=${activityUser.id}`)}
                    className="text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Voir tout l'historique dans l'administration →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogue coffre-fort d'identifiants */}
      <Dialog open={!!credApp} onOpenChange={(open) => { if (!open) setCredApp(null) }}>
        <DialogContent className="bg-surface border border-line sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-ink flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-brand" />
              {credMode === "view"
                ? "Identifiant enregistré"
                : credApp && credAppIds.includes(credApp.id)
                ? "Modifier l'identifiant"
                : "Ajouter un identifiant"}
              {credApp ? ` — ${credApp.nom}` : ""}
            </DialogTitle>
          </DialogHeader>

          {credError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">{credError}</div>
          )}

          {credMode === "add" ? (
            <form onSubmit={saveCredential} className="space-y-4">
              <div>
                <Label className="text-ink font-medium">Login</Label>
                <Input
                  value={credForm.login}
                  onChange={(e) => setCredForm({ ...credForm, login: e.target.value })}
                  placeholder="Identifiant / email"
                  className="mt-1 bg-surface border-line text-ink"
                  required
                />
              </div>
              <div>
                <Label className="text-ink font-medium">Mot de passe</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={credForm.password}
                    onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                    placeholder="Mot de passe de l'application"
                    className="bg-surface border-line text-ink pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-ink font-medium">Note <span className="text-ink-faint font-normal">(optionnel)</span></Label>
                <Input
                  value={credForm.note}
                  onChange={(e) => setCredForm({ ...credForm, note: e.target.value })}
                  placeholder="Remarque, URL spécifique, 2FA…"
                  className="mt-1 bg-surface border-line text-ink"
                />
              </div>
              <p className="text-xs text-ink-faint">🔒 Chiffré au repos. Visible par vous seul.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => setCredApp(null)}
                  className="bg-surface-muted hover:bg-surface-muted text-ink">Annuler</Button>
                <Button type="submit" disabled={credLoading}
                  className="bg-brand hover:bg-brand-hover text-white disabled:opacity-50">
                  {credLoading ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {credLoading ? (
                <p className="text-ink-muted text-sm">Chargement...</p>
              ) : (
                <>
                  <div>
                    <Label className="text-ink-muted text-xs">Login</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input readOnly value={credForm.login} className="bg-app border-line text-ink" />
                      <button type="button" onClick={() => navigator.clipboard?.writeText(credForm.login)}
                        title="Copier" className="p-2 text-ink-muted hover:text-brand"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-ink-muted text-xs">Mot de passe</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input readOnly type={showPassword ? "text" : "password"} value={credForm.password}
                        className="bg-app border-line text-ink" />
                      <button type="button" onClick={() => setShowPassword((s) => !s)} title={showPassword ? "Masquer" : "Afficher"}
                        className="p-2 text-ink-muted hover:text-brand">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(credForm.password)}
                        title="Copier" className="p-2 text-ink-muted hover:text-brand"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {credForm.note && (
                    <div>
                      <Label className="text-ink-muted text-xs">Note</Label>
                      <Input readOnly value={credForm.note} className="bg-app border-line text-ink mt-1" />
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <Button type="button" onClick={deleteCredential} disabled={credLoading}
                      className="bg-transparent hover:bg-red-50 text-danger border border-danger">
                      <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                    </Button>
                    <Button type="button" onClick={() => { setCredMode("add") }}
                      className="bg-brand hover:bg-brand-hover text-white">Modifier</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
