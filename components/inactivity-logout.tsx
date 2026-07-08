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

  // Refs pour éviter de recréer les timers à chaque rendu
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const showWarningRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    warningTimer.current = null
    countdownTimer.current = null
  }, [])

  const logout = useCallback(async () => {
    clearTimers()
    showWarningRef.current = false
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // on redirige quand même
    }
    router.push("/login")
  }, [clearTimers, router])

  // Lance (ou relance) le cycle complet de 15 min
  const startCycle = useCallback(() => {
    clearTimers()
    showWarningRef.current = false
    setShowWarning(false)
    warningTimer.current = setTimeout(() => {
      // 10 min écoulées sans activité → on affiche la fenêtre et le décompte
      showWarningRef.current = true
      setRemaining(WARNING_BEFORE)
      setShowWarning(true)
      countdownTimer.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            logout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, WARNING_AT * 1000)
  }, [clearTimers, logout])

  // « Je suis toujours là » : ferme la fenêtre et repart pour un cycle complet
  const stayConnected = useCallback(() => {
    startCycle()
  }, [startCycle])

  useEffect(() => {
    if (disabled) {
      clearTimers()
      setShowWarning(false)
      return
    }

    // Toute activité relance le cycle — mais uniquement TANT QUE la fenêtre
    // d'avertissement n'est pas affichée. Une fois la fenêtre visible, seul le
    // bouton « Je suis toujours là » peut relancer (réponse A = i).
    const onActivity = () => {
      if (showWarningRef.current) return
      startCycle()
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))
    startCycle()

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity))
      clearTimers()
    }
  }, [disabled, pathname, startCycle, clearTimers])

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
