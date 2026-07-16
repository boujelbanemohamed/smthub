"use client"

import { useEffect, useState } from "react"

// Bloc d'en-tête affiché lorsque l'utilisateur est rattaché à une banque :
// séparateur + logo de la banque + nom + « Connecté en tant que {rôle} » (rouge).
// Réutilisable sur toutes les pages (accueil, admin, profil…) pour un en-tête
// cohérent. Se charge seul via /api/auth/check et /api/my-bank.
export function BankHeaderInfo() {
  const [role, setRole] = useState<string | null>(null)
  const [banqueId, setBanqueId] = useState<number | null>(null)
  const [bank, setBank] = useState<{ nom: string; logo_url?: string | null } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/check")
        if (!res.ok) return
        const data = await res.json()
        const u = data?.user
        if (!active || !u || u.banque_id == null) return
        setRole(u.role)
        setBanqueId(u.banque_id)
        const rb = await fetch("/api/my-bank")
        if (rb.ok && active) setBank(await rb.json())
      } catch {
        /* silencieux */
      }
    })()
    return () => { active = false }
  }, [])

  if (banqueId == null || !bank) return null

  const roleLabel = role === "admin" ? "Administrateur de banque" : "Utilisateur banque"

  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-8 w-px bg-line hidden sm:block" aria-hidden />
      {bank.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bank.logo_url} alt={bank.nom} className="h-8 w-8 rounded-md object-contain border border-line bg-white shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-md bg-surface-muted border border-line flex items-center justify-center text-ink text-xs font-semibold shrink-0">
          {bank.nom.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="hidden sm:flex flex-col leading-tight min-w-0">
        <span className="text-ink font-medium text-sm truncate">{bank.nom}</span>
        <span className="text-[11px] font-bold text-red-600 truncate">Connecté en tant que {roleLabel}</span>
      </div>
    </div>
  )
}
