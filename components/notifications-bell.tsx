"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, Check } from "lucide-react"

interface Notif {
  id: string
  type: string
  message: string
  link?: string | null
  read: boolean
  created_at: string
}

// Cloche de notifications : compteur de non-lues + menu déroulant. Sondage
// périodique de /api/notifications. Réutilisable dans tous les en-têtes.
export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const d = await res.json()
        setItems(d.notifications || [])
        setUnread(d.unread || 0)
      }
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  // Fermer au clic extérieur
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => {})
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const onOpenNotif = async (n: Notif) => {
    if (!n.read) {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {})
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
    }
    if (n.link) window.open(n.link, "_blank", "noopener,noreferrer")
  }

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) } catch { return "" }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-ink-muted hover:bg-surface-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-surface border border-line rounded-lg shadow-lg z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <span className="font-semibold text-ink text-sm">Notifications</span>
            {items.some((n) => !n.read) && (
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                <Check className="w-3.5 h-3.5" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">Aucune notification.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpenNotif(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-line hover:bg-surface-muted transition-colors ${n.read ? "" : "bg-brand/5"}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand shrink-0" aria-hidden />}
                    <div className={`min-w-0 ${n.read ? "pl-4" : ""}`}>
                      <p className={`text-sm ${n.read ? "text-ink-muted" : "text-ink font-medium"}`}>{n.message}</p>
                      <p className="text-[11px] text-ink-faint mt-0.5">{fmt(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
