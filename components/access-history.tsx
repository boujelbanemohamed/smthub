"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, UserPlus, UserMinus, Edit, Clock, User, Monitor } from "lucide-react"
import { AccessLevelBadge, type AccessLevel } from "./access-level-selector"

interface AccessHistoryEntry {
  id: string
  utilisateur_id: number
  application_id: number
  action: "granted" | "revoked" | "modified"
  old_level?: string
  new_level?: string
  performed_by: number
  performed_at: string
  ip_address?: string
  user_agent?: string
}

interface AccessHistoryProps {
  userId?: number
  appId?: number
  limit?: number
  showUserInfo?: boolean
  showAppInfo?: boolean
}

interface User {
  id: number
  nom: string
  email: string
}

interface Application {
  id: number
  nom: string
  image_url: string
}

export function AccessHistory({ 
  userId, 
  appId, 
  limit = 20,
  showUserInfo = true,
  showAppInfo = true 
}: AccessHistoryProps) {
  const [history, setHistory] = useState<AccessHistoryEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    loadHistory()
    loadUsersAndApps()
  }, [userId, appId])

  const loadHistory = async (loadMore = false) => {
    try {
      const params = new URLSearchParams()
      if (userId) params.append("user_id", userId.toString())
      if (appId) params.append("app_id", appId.toString())
      params.append("limit", limit.toString())
      params.append("offset", loadMore ? offset.toString() : "0")

      const res = await fetch(`/api/access-history?${params}`)
      if (res.ok) {
        const data = await res.json()
        
        if (loadMore) {
          setHistory(prev => [...prev, ...data.history])
          setOffset(prev => prev + limit)
        } else {
          setHistory(data.history)
          setOffset(limit)
        }
        
        setHasMore(data.hasMore)
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsersAndApps = async () => {
    try {
      const [usersRes, appsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/applications")
      ])

      if (usersRes.ok && appsRes.ok) {
        const [usersData, appsData] = await Promise.all([
          usersRes.json(),
          appsRes.json()
        ])
        
        setUsers(usersData)
        setApplications(appsData)
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error)
    }
  }

  const getUserName = (id: number) => {
    const user = users.find(u => u.id === id)
    return user ? user.nom : `Utilisateur #${id}`
  }

  const getAppName = (id: number) => {
    const app = applications.find(a => a.id === id)
    return app ? app.nom : `Application #${id}`
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "granted":
        return <UserPlus className="w-4 h-4 text-green-600" />
      case "revoked":
        return <UserMinus className="w-4 h-4 text-red-600" />
      case "modified":
        return <Edit className="w-4 h-4 text-blue-600" />
      default:
        return <History className="w-4 h-4 text-gray-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "granted":
        return "bg-green-100 text-green-800 border-green-300"
      case "revoked":
        return "bg-red-100 text-red-800 border-red-300"
      case "modified":
        return "bg-blue-100 text-blue-800 border-blue-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case "granted":
        return "Accès accordé"
      case "revoked":
        return "Accès retiré"
      case "modified":
        return "Accès modifié"
      default:
        return action
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-blue-700">Chargement de l'historique...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <History className="w-5 h-5" />
          Historique des modifications d'accès
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune modification d'accès enregistrée</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(entry.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getActionColor(entry.action)}>
                        {getActionLabel(entry.action)}
                      </Badge>
                      
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.performed_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {showUserInfo && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{getUserName(entry.utilisateur_id)}</span>
                        </div>
                      )}
                      
                      {showAppInfo && (
                        <div className="flex items-center gap-2 text-sm">
                          <Monitor className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{getAppName(entry.application_id)}</span>
                        </div>
                      )}
                      
                      {entry.action === "modified" && entry.old_level && entry.new_level && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Niveau d'accès :</span>
                          <AccessLevelBadge level={entry.old_level as AccessLevel} />
                          <span className="text-gray-400">→</span>
                          <AccessLevelBadge level={entry.new_level as AccessLevel} />
                        </div>
                      )}
                      
                      {(entry.action === "granted" || entry.action === "revoked") && entry.new_level && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Niveau :</span>
                          <AccessLevelBadge level={entry.new_level as AccessLevel} />
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Par {getUserName(entry.performed_by)} • IP: {entry.ip_address}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="text-center mt-4">
                <Button
                  onClick={() => loadHistory(true)}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700"
                >
                  Charger plus d'entrées
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
