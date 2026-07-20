"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Activity, AppWindow, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { BankHeaderInfo } from "@/components/bank-header-info"
import { UserHeaderInfo } from "@/components/user-header-info"
import { NotificationsBell } from "@/components/notifications-bell"
import { ThemeToggle } from "@/components/theme-toggle"

interface OpenItem { id: string; timestamp: string; appName: string; appId: number | null }
interface EventItem { id: string; timestamp: string; action: string; details: string; level: string }

const PAGE = 15

export default function MyActivityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [opens, setOpens] = useState<OpenItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [pOpens, setPOpens] = useState(0)
  const [pEvents, setPEvents] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const auth = await fetch("/api/auth/check")
        if (!auth.ok) { router.push("/login"); return }
        const d = await auth.json()
        if (!d?.isAuthenticated) { router.push("/login"); return }
        const res = await fetch("/api/my-activity")
        if (res.ok) {
          const data = await res.json()
          setOpens(data.opens || [])
          setEvents(data.events || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) } catch { return "" }
  }

  const pageOpens = opens.slice(pOpens * PAGE, pOpens * PAGE + PAGE)
  const pageEvents = events.slice(pEvents * PAGE, pEvents * PAGE + PAGE)
  const nOpensPages = Math.max(1, Math.ceil(opens.length / PAGE))
  const nEventsPages = Math.max(1, Math.ceil(events.length / PAGE))

  return (
    <div className="min-h-screen bg-app">
      <header className="bg-surface border-b border-line shadow-sm sticky top-0 z-50">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4 min-w-0">
              <BrandLogo height={32} />
              <div className="hidden lg:block shrink-0">
                <span className="text-lg font-semibold text-ink">Mon activité</span>
                <p className="text-sm text-ink-muted">Historique personnel</p>
              </div>
              <BankHeaderInfo />
            </div>
            <div className="flex items-center space-x-3">
              <UserHeaderInfo />
              <NotificationsBell />
              <ThemeToggle />
              <Link href="/">
                <Button className="bg-surface-muted hover:bg-surface-muted text-ink font-medium px-4 py-2 rounded-md text-sm">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-brand" />
          <h1 className="text-2xl font-bold text-ink">Mon activité</h1>
        </div>

        {loading ? (
          <p className="text-ink-muted">Chargement…</p>
        ) : (
          <>
            {/* Ouvertures d'applications */}
            <section className="bg-surface border border-line rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AppWindow className="w-5 h-5 text-brand" />
                <h2 className="font-semibold text-ink">Mes ouvertures d'applications</h2>
                <span className="text-xs text-ink-faint">({opens.length})</span>
              </div>
              {opens.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucune ouverture enregistrée pour l'instant.</p>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {pageOpens.map((o) => (
                      <li key={o.id} className="flex items-center justify-between py-2">
                        <span className="text-sm text-ink font-medium truncate">{o.appName}</span>
                        <span className="text-xs text-ink-muted shrink-0">{fmt(o.timestamp)}</span>
                      </li>
                    ))}
                  </ul>
                  {nOpensPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <Button variant="outline" size="sm" className="border-line text-ink" disabled={pOpens === 0} onClick={() => setPOpens((p) => p - 1)}>Précédent</Button>
                      <span className="text-ink-muted">Page {pOpens + 1} / {nOpensPages}</span>
                      <Button variant="outline" size="sm" className="border-line text-ink" disabled={pOpens >= nOpensPages - 1} onClick={() => setPOpens((p) => p + 1)}>Suivant</Button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Événements du compte */}
            <section className="bg-surface border border-line rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-brand" />
                <h2 className="font-semibold text-ink">Événements de mon compte</h2>
                <span className="text-xs text-ink-faint">({events.length})</span>
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucun événement pour l'instant (accès accordés/retirés, modifications de profil…).</p>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {pageEvents.map((e) => (
                      <li key={e.id} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-ink font-medium">{e.action}</span>
                          <span className="text-xs text-ink-muted shrink-0">{fmt(e.timestamp)}</span>
                        </div>
                        {e.details && <p className="text-xs text-ink-muted mt-0.5">{e.details}</p>}
                      </li>
                    ))}
                  </ul>
                  {nEventsPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <Button variant="outline" size="sm" className="border-line text-ink" disabled={pEvents === 0} onClick={() => setPEvents((p) => p - 1)}>Précédent</Button>
                      <span className="text-ink-muted">Page {pEvents + 1} / {nEventsPages}</span>
                      <Button variant="outline" size="sm" className="border-line text-ink" disabled={pEvents >= nEventsPages - 1} onClick={() => setPEvents((p) => p + 1)}>Suivant</Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
