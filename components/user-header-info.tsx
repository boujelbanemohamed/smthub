"use client"

import { useEffect, useState } from "react"
import { UserAvatar } from "@/components/ui/user-avatar"

// Bloc d'en-tête : photo + nom + email de l'utilisateur connecté, comme sur le
// dashboard. Réutilisable sur toutes les pages. Se charge seul via /api/auth/check.
export function UserHeaderInfo({ size = 36 }: { size?: number }) {
  const [user, setUser] = useState<{ nom: string; email: string; avatar?: string | null } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/check")
        if (!res.ok) return
        const data = await res.json()
        if (active && data?.user) setUser(data.user)
      } catch {
        /* silencieux */
      }
    })()
    return () => { active = false }
  }, [])

  if (!user) return null

  return (
    <div className="flex items-center space-x-3">
      <UserAvatar name={user.nom} avatar={user.avatar} size={size} />
      <div className="hidden md:block">
        <p className="text-ink font-medium leading-tight">{user.nom}</p>
        <p className="text-ink-muted text-sm leading-tight">{user.email}</p>
      </div>
    </div>
  )
}
