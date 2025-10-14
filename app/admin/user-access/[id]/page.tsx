"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, Settings, Eye, UserCheck, UserX, Clock, Mail, History } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { AccessLevelSelector, AccessLevelBadge, type AccessLevel } from "@/components/access-level-selector"
import { AccessHistory } from "@/components/access-history"

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

interface UserAccess {
  utilisateur_id: number
  application_id: number
}

interface UserAccessRole {
  utilisateur_id: number
  application_id: number
  access_level: AccessLevel
  granted_by: number
  granted_at: string
  last_modified: string
}

// Helpers for avatar fallback when image_url is empty
function getAvatarColor(name: string) {
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

export default function UserAccessPage() {
  const [user, setUser] = useState<User | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [userAccess, setUserAccess] = useState<UserAccess[]>([])
  const [userAccessRoles, setUserAccessRoles] = useState<UserAccessRole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const params = useParams()
  const userId = parseInt(params.id as string)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/check")
      if (res.ok) {
        const data = await res.json()
        if (data.user?.role === "admin") {
          loadData()
        } else {
          router.push("/")
        }
      } else {
        router.push("/login")
      }
    } catch (error) {
      router.push("/login")
    }
  }

  const loadData = async () => {
    try {
      const [usersRes, appsRes, accessRes, rolesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/applications"),
        fetch("/api/user-access"),
        fetch(`/api/user-access-roles?user_id=${userId}`)
      ])

      if (usersRes.ok && appsRes.ok && accessRes.ok && rolesRes.ok) {
        const [usersData, appsData, accessData, rolesData] = await Promise.all([
          usersRes.json(),
          appsRes.json(),
          accessRes.json(),
          rolesRes.json()
        ])

        const targetUser = usersData.find((u: User) => u.id === userId)
        if (!targetUser) {
          router.push("/admin")
          return
        }

        setUser(targetUser)
        setApplications(appsData.sort((a: Application, b: Application) => a.ordre_affichage - b.ordre_affichage))
        setUserAccess(accessData)
        setUserAccessRoles(rolesData)
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error)
    } finally {
      setLoading(false)
    }
  }

  const hasAccess = (appId: number) => {
    return userAccess.some((access) => access.utilisateur_id === userId && access.application_id === appId)
  }

  const getAccessLevel = (appId: number): AccessLevel => {
    const role = userAccessRoles.find(
      (role) => role.utilisateur_id === userId && role.application_id === appId
    )
    return role?.access_level || "none"
  }

  const handleAccessLevelChange = async (appId: number, newLevel: AccessLevel) => {
    setSaving(true)
    try {
      const res = await fetch("/api/user-access-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilisateur_id: userId,
          application_id: appId,
          access_level: newLevel,
        }),
      })

      if (res.ok) {
        // Reload roles data
        const rolesRes = await fetch(`/api/user-access-roles?user_id=${userId}`)
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json()
          setUserAccessRoles(rolesData)
        }

        // Also update basic access for backward compatibility
        if (newLevel !== "none") {
          await fetch("/api/user-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              utilisateur_id: userId,
              application_id: appId,
              grant_access: true,
            }),
          })
        } else {
          await fetch("/api/user-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              utilisateur_id: userId,
              application_id: appId,
              grant_access: false,
            }),
          })
        }

        // Reload access data
        const accessRes = await fetch("/api/user-access")
        if (accessRes.ok) {
          const accessData = await accessRes.json()
          setUserAccess(accessData)
        }
      }
    } catch (error) {
      console.error("Erreur lors de la modification du niveau d'accès:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleAccessChange = async (appId: number, grantAccess: boolean) => {
    setSaving(true)
    try {
      const res = await fetch("/api/user-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilisateur_id: userId,
          application_id: appId,
          grant_access: grantAccess,
        }),
      })

      if (res.ok) {
        // Reload access data
        const accessRes = await fetch("/api/user-access")
        if (accessRes.ok) {
          const accessData = await accessRes.json()
          setUserAccess(accessData)
        }
      }
    } catch (error) {
      console.error("Erreur lors de la modification d'accès:", error)
    } finally {
      setSaving(false)
    }
  }

  const grantAllAccess = async (level: AccessLevel = "read") => {
    setSaving(true)
    try {
      const promises = applications.map(app => {
        if (getAccessLevel(app.id) === "none") {
          return handleAccessLevelChange(app.id, level)
        }
        return Promise.resolve()
      })

      await Promise.all(promises)
    } catch (error) {
      console.error("Erreur lors de l'attribution de tous les accès:", error)
    } finally {
      setSaving(false)
    }
  }

  const revokeAllAccess = async () => {
    setSaving(true)
    try {
      const promises = applications.map(app => {
        if (getAccessLevel(app.id) !== "none") {
          return handleAccessLevelChange(app.id, "none")
        }
        return Promise.resolve()
      })

      await Promise.all(promises)
    } catch (error) {
      console.error("Erreur lors de la révocation de tous les accès:", error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-blue-700 text-xl">Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-700 text-xl">Utilisateur non trouvé</div>
      </div>
    )
  }

  const userAppsCount = applications.filter(app => getAccessLevel(app.id) !== "none").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button
              variant="outline"
              className="flex items-center gap-2 bg-white/80 border-blue-200 hover:bg-blue-50 text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l'administration
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-800 via-blue-900 to-slate-800 bg-clip-text text-transparent">
              Gestion des accès
            </h1>
            <p className="text-blue-700 mt-2 text-lg">Configuration individuelle pour {user.nom}</p>
          </div>
        </div>

        {/* User Info Card */}
        <Card className="mb-8 bg-gradient-to-r from-white/95 to-blue-50/80 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-blue-900">{user.nom}</CardTitle>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-700">{user.email}</span>
                    </div>
                    <Badge variant="outline" className="border-blue-300 text-blue-700">
                      {user.role === "admin" ? "Administrateur" : "Utilisateur"}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-900">
                  {userAppsCount}/{applications.length}
                </div>
                <div className="text-blue-700 text-sm">Applications autorisées</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-8 bg-gradient-to-r from-white/95 to-blue-50/80 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => grantAllAccess("read")}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                {saving ? "Attribution..." : "Lecture seule pour tout"}
              </Button>

              <Button
                onClick={() => grantAllAccess("write")}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                {saving ? "Attribution..." : "Lecture/Écriture pour tout"}
              </Button>

              <Button
                onClick={revokeAllAccess}
                disabled={saving || userAppsCount === 0}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <UserX className="w-4 h-4 mr-2" />
                {saving ? "Révocation..." : "Retirer tous les accès"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Applications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {applications.map((app) => {
            const currentLevel = getAccessLevel(app.id)
            const roleData = userAccessRoles.find(
              role => role.application_id === app.id && role.utilisateur_id === userId
            )

            return (
              <Card
                key={app.id}
                className={`transition-all duration-200 ${
                  currentLevel !== "none"
                    ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md"
                    : "bg-gradient-to-r from-white/95 to-blue-50/80 border-blue-200"
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    {app.image_url ? (
                      <Image
                        src={app.image_url}
                        alt={app.nom}
                        width={48}
                        height={48}
                        className="object-contain rounded-lg"
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-lg text-white font-bold"
                        style={{ width: 48, height: 48, backgroundColor: getAvatarColor(app.nom), fontSize: 18 }}
                        aria-label={app.nom}
                        title={app.nom}
                      >
                        {getInitials(app.nom)}
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-xl text-blue-900 mb-1">{app.nom}</CardTitle>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-blue-600">Ordre: {app.ordre_affichage}</p>
                        <AccessLevelBadge level={currentLevel} size="md" />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-blue-900 mb-2 block">
                      Niveau d'accès
                    </label>
                    <AccessLevelSelector
                      currentLevel={currentLevel}
                      onLevelChange={(level) => handleAccessLevelChange(app.id, level)}
                      disabled={saving}
                      size="md"
                    />
                  </div>

                  {roleData && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Historique</span>
                      </div>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>
                          <strong>Accordé le:</strong> {new Date(roleData.granted_at).toLocaleString('fr-FR')}
                        </div>
                        <div>
                          <strong>Modifié le:</strong> {new Date(roleData.last_modified).toLocaleString('fr-FR')}
                        </div>
                        <div>
                          <strong>Par admin ID:</strong> {roleData.granted_by}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                    <a
                      href={app.app_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      Voir l'application
                    </a>

                    {currentLevel !== "none" && (
                      <Button
                        onClick={() => handleAccessLevelChange(app.id, "none")}
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        disabled={saving}
                      >
                        <UserX className="w-3 h-3 mr-1" />
                        Retirer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {applications.length === 0 && (
          <Card className="bg-gradient-to-r from-white/95 to-blue-50/80 border-blue-200">
            <CardContent className="p-16 text-center">
              <div className="text-6xl mb-6 opacity-60">📱</div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-900">Aucune application</h3>
              <p className="text-blue-700 text-lg">Ajoutez des applications pour gérer les accès.</p>
            </CardContent>
          </Card>
        )}

        {/* Access History */}
        <div className="mt-12">
          <AccessHistory
            userId={userId}
            showUserInfo={false}
            showAppInfo={true}
            limit={10}
          />
        </div>
      </div>
    </div>
  )
}
