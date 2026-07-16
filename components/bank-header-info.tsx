"use client"

import { useEffect, useState } from "react"

// Bloc d'en-tête affichant le rôle de l'utilisateur connecté (« Connecté en tant
// que … » en rouge) pour TOUS les rôles. Si l'utilisateur est rattaché à une
// banque, on affiche aussi le logo + le nom de la banque. Réutilisable sur
// toutes les pages ; se charge seul via /api/auth/check et /api/my-bank.
export function BankHeaderInfo() {
  const [role, setRole] = useState<string | null>(null)
  const [banqueId, setBanqueId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [bank, setBank] = useState<{ nom: string; logo_url?: string | null } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/check")
        if (!res.ok) return
        const data = await res.json()
        const u = data?.user
        if (!active || !u) return
        setRole(u.role)
        setBanqueId(u.banque_id ?? null)
        setLoaded(true)
        if (u.banque_id != null) {
          const rb = await fetch("/api/my-bank")
          if (rb.ok && active) setBank(await rb.json())
        }
      } catch {
        /* silencieux */
      }
    })()
    return () => { active = false }
  }, [])

  if (!loaded) return null

  const roleLabel =
    role === "admin"
      ? (banqueId != null ? "Administrateur de banque" : "Super administrateur")
      : (banqueId != null ? "Utilisateur banque" : "Utilisateur")

  const inBank = banqueId != null && bank

  return (
    <div className="flex items-center gap-3 shrink-0">
      <span className="h-8 w-px bg-line hidden sm:block" aria-hidden />
      {inBank ? (
        bank!.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bank!.logo_url} alt={bank!.nom} className="h-8 w-8 rounded-md object-contain border border-line bg-white shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-md bg-surface-muted border border-line flex items-center justify-center text-ink text-xs font-semibold shrink-0">
            {bank!.nom.charAt(0).toUpperCase()}
          </div>
        )
      ) : null}
      <div className="hidden sm:flex flex-col leading-tight">
        {inBank ? <span className="text-ink font-medium text-sm whitespace-nowrap">{bank!.nom}</span> : null}
        <span className="text-[10px] text-red-500 whitespace-nowrap leading-none">Connecté en tant que</span>
        <span className="text-xs font-bold text-red-600 whitespace-nowrap leading-tight">{roleLabel}</span>
      </div>
    </div>
  )
}
