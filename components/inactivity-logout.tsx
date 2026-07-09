"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Clock, X } from "lucide-react"

// Durées (en secondes)
const INACTIVITY_LIMIT = 15 * 60 // 15 min avant déconnexion
const WARNING_BEFORE = 5 * 60 // la fenêtre apparaît 5 min avant la déconnexion
const WARNING_AT = INACTIVITY_LIMIT - WARNING_BEFORE // soit à 10 min d'inactivité

// Pages publiques : pas de surveillance d'inactivité
const EXCLUDED = ["/login", "/admin/login", "/forgot-password", "/reset-password"]

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const

export function InactivityLogout() {
  const router = useRouter()
  const pathname = usePathname()
  const disabled = EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + "/"))

  const [showWarning, setShowWarning] = useState(false)
  const [remaining, setRemaining] = useState(WARNING_BEFORE)

  // Horodatage (temps réel) de la dernière activité : sert de référence au lieu
  // de compter des « tics » de minuteur, qui sont ralentis quand l'onglet est
  // en arrière-plan. Ainsi le calcul reste exact même après une mise en veille.
  const lastActivityRef = useRef(Date.now())
  const showWarningRef = useRef(false)
  const loggingOutRef = useRef(false)

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    showWarningRef.current = false
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // on redirige quand même
    }
    router.push("/login")
  }, [router])

  // Réinitialise le compteur (activité détectée ou clic « Je suis toujours là »)
  const resetInactivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    showWarningRef.current = false
    setShowWarning(false)
  }, [])

  // Évalue l'état à partir du TEMPS RÉEL écoulé depuis la dernière activité.
  // Appelée chaque seconde, mais aussi au retour sur l'onglet (visibilitychange
  // / focus) : si l'inactivité a dépassé la limite pendant l'absence, la
  // déconnexion est déclenchée immédiatement au retour.
  const evaluate = useCallback(() => {
    const elapsed = (Date.now() - lastActivityRef.current) / 1000
    if (elapsed >= INACTIVITY_LIMIT) {
      logout()
      return
    }
    if (elapsed >= WARNING_AT) {
      showWarningRef.current = true
      setShowWarning(true)
      setRemaining(Math.max(0, Math.ceil(INACTIVITY_LIMIT - elapsed)))
    } else if (showWarningRef.current) {
      showWarningRef.current = false
      setShowWarning(false)
    }
  }, [logout])

  // « Je suis toujours là » : ferme la fenêtre et repart pour un cycle complet
  const stayConnected = useCallback(() => {
    resetInactivity()
  }, [resetInactivity])

  useEffect(() => {
    if (disabled) {
      setShowWarning(false)
      return
    }

    resetInactivity()

    // Toute activité remet le compteur à zéro — mais uniquement TANT QUE la
    // fenêtre d'avertissement n'est pas affichée. Une fois visible, seul le
    // bouton « Je suis toujours là » peut relancer (réponse A = i).
    const onActivity = () => {
      if (showWarningRef.current) return
      lastActivityRef.current = Date.now()
    }
    // Au retour sur l'onglet, réévaluer immédiatement le temps réel écoulé.
    const onVisible = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") evaluate()
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    const id = setInterval(evaluate, 1000)
    evaluate()

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity))
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      clearInterval(id)
    }
  }, [disabled, pathname, evaluate, resetInactivity])

  // Heartbeat de présence : signale que l'utilisateur est en ligne (au montage
  // puis toutes les 60 s) pour alimenter les listes « connectés / non connectés ».
  useEffect(() => {
    if (disabled) return
    const ping = () => { fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {}) }
    ping()
    const id = setInterval(ping, 60_000)
    return () => clearInterval(id)
  }, [disabled, pathname])

  if (disabled || !showWarning) return null

  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, "0")

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-lg bg-surface border border-line shadow-xl p-6">
        <button
          type="button"
          onClick={stayConnected}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-ink-faint hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-ink">Déconnexion imminente</h2>
        </div>

        <p className="text-ink-muted text-sm mb-1">
          Vous allez être déconnecté pour cause d'inactivité dans :
        </p>
        <p className="text-3xl font-bold text-ink tabular-nums mb-5">
          {mm}:{ss}
        </p>

        <div className="flex justify-end">
          <Button onClick={stayConnected} className="bg-brand hover:bg-brand-hover text-white">
            Je suis toujours là
          </Button>
        </div>
      </div>
    </div>
  )
}
