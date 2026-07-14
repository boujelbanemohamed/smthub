"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { AppAvatar } from "@/components/ui/app-avatar"

interface App {
  id: number
  nom: string
  app_url: string
  image_url?: string
  avatar_color?: string
  open_mode?: "newtab" | "embed" | "embed_newtab"
}

// Affiche une application « intégrée » dans le portail (iframe), avec un en-tête
// SMT HUB (retour + nom + ouvrir dans un nouvel onglet). L'utilisateur reste
// dans le portail. Note : certains sites externes interdisent l'affichage en
// iframe — dans ce cas un secours propose l'ouverture en nouvel onglet.
export default function EmbedPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id)
  const [app, setApp] = useState<App | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "unauthorized">("loading")
  const [showFallback, setShowFallback] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/user-applications")
        if (res.status === 401) { if (active) setStatus("unauthorized"); return }
        const apps: App[] = res.ok ? await res.json() : []
        const found = apps.find((a) => a.id === id) || null
        if (!active) return
        if (!found) { setStatus("notfound"); return }
        setApp(found)
        setStatus("ready")
      } catch {
        if (active) setStatus("notfound")
      }
    })()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (status !== "ready") return
    // Si l'iframe n'a pas signalé son chargement au bout de 6 s, on suppose que
    // le site bloque l'affichage en iframe → on propose le secours.
    const t = setTimeout(() => { if (!loadedRef.current) setShowFallback(true) }, 6000)
    return () => clearTimeout(t)
  }, [status])

  if (status === "unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app p-6 text-center">
        <div>
          <p className="text-ink mb-3">Vous devez être connecté pour ouvrir cette application.</p>
          <button onClick={() => router.push("/login")} className="text-brand underline">Se connecter</button>
        </div>
      </div>
    )
  }

  if (status === "notfound") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app p-6 text-center">
        <div>
          <p className="text-ink mb-3">Application introuvable ou accès non autorisé.</p>
          <Link href="/" className="text-brand underline">Retour au portail</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-app">
      {/* En-tête SMT HUB */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="inline-flex items-center gap-1 text-ink-muted hover:text-brand transition-colors">
            <ArrowLeft className="w-4 h-4" /> Portail
          </Link>
          <span className="text-line">|</span>
          {app ? <AppAvatar app={app as any} size={24} /> : null}
          <span className="font-medium text-ink truncate">{app?.nom}</span>
        </div>
        {app && app.open_mode === "embed_newtab" ? (
          <a href={app.app_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand transition-colors shrink-0">
            <ExternalLink className="w-4 h-4" /> Nouvel onglet
          </a>
        ) : null}
      </header>

      {/* Cadre de l'application */}
      <div className="relative flex-1">
        {app ? (
          <iframe
            src={app.app_url}
            title={app.nom}
            className="absolute inset-0 h-full w-full border-0"
            onLoad={() => { loadedRef.current = true; setShowFallback(false) }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-top-navigation-by-user-activation"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : null}

        {showFallback ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-md rounded-lg bg-surface border border-line shadow-xl p-4 text-center">
            <p className="text-sm text-ink-muted mb-2">
              Cette application ne s'affiche peut-être pas en intégré (certains sites l'interdisent).
            </p>
            {app ? (
              <a href={app.app_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand font-medium">
                <ExternalLink className="w-4 h-4" /> Ouvrir dans un nouvel onglet
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
