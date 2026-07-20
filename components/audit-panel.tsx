"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, ShieldCheck, ShieldAlert, Download, FileText, Search, RefreshCw } from "lucide-react"

interface AuditEvent {
  id: string
  timestamp: string
  category: string
  action: string
  status: string
  userId: number | null
  userName: string | null
  details: string
  hash: string | null
}
interface Integrity {
  ok: boolean
  brokenAt: number
  total: number
}

export function AuditPanel({ users }: { users: { id: number; nom: string }[] }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [integrity, setIntegrity] = useState<Integrity | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Filtres
  const [q, setQ] = useState("")
  const [category, setCategory] = useState("")
  const [userId, setUserId] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q) p.set("q", q)
      if (category) p.set("category", category)
      if (userId) p.set("userId", userId)
      if (from) p.set("from", from)
      if (to) p.set("to", to)
      const r = await fetch("/api/admin/audit?" + p.toString())
      if (r.ok) {
        const d = await r.json()
        setEvents(d.events || [])
        setIntegrity(d.integrity || null)
        setCategories(d.categories || [])
      }
    } catch { /* silencieux */ } finally {
      setLoading(false)
    }
  }, [q, category, userId, from, to])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })

  const resetFilters = () => {
    setQ(""); setCategory(""); setUserId(""); setFrom(""); setTo("")
    setTimeout(load, 0)
  }

  // --- Export CSV ---
  const exportCsv = () => {
    const header = ["Date", "Catégorie", "Action", "Statut", "Utilisateur", "Détails", "Empreinte"]
    const rows = events.map((e) => [
      fmt(e.timestamp), e.category, e.action, e.status,
      e.userName || (e.userId != null ? `#${e.userId}` : "—"),
      (e.details || "").replace(/\s+/g, " "),
      e.hash || "",
    ])
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    triggerDownload(blob, `audit-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // --- Export PDF (horodaté) ---
  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf")
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" })
    doc.setFontSize(14)
    doc.text("Journal d'audit — SMT HUB", 40, 40)
    doc.setFontSize(9)
    doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, 40, 58)
    const seal = integrity
      ? integrity.ok
        ? `Intégrité vérifiée : chaîne intacte (${integrity.total} entrées).`
        : `ALERTE : rupture d'intégrité détectée à l'entrée #${integrity.brokenAt}.`
      : ""
    doc.text(seal, 40, 72)
    autoTable(doc, {
      startY: 88,
      head: [["Date", "Catégorie", "Action", "Statut", "Utilisateur", "Détails", "Empreinte"]],
      body: events.map((e) => [
        fmt(e.timestamp), e.category, e.action, e.status,
        e.userName || (e.userId != null ? `#${e.userId}` : "—"),
        e.details || "", e.hash || "",
      ]),
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [30, 64, 120] },
      columnStyles: { 5: { cellWidth: 240 } },
    })
    doc.save(`audit-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const catColor: Record<string, string> = {
    Authentification: "bg-blue-100 text-blue-700",
    "Sécurité": "bg-red-100 text-red-700",
    "Accès": "bg-amber-100 text-amber-700",
    Utilisateurs: "bg-purple-100 text-purple-700",
    Applications: "bg-green-100 text-green-700",
    Banques: "bg-teal-100 text-teal-700",
    Configuration: "bg-gray-100 text-gray-700",
  }

  return (
    <div className="space-y-4">
      {/* Bandeau d'intégrité */}
      {integrity && (
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
            integrity.ok
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {integrity.ok ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          <div className="text-sm">
            {integrity.ok ? (
              <>
                <strong>Intégrité vérifiée.</strong> La chaîne de journalisation est intacte
                ({integrity.total} entrées) — aucune ligne modifiée ou supprimée.
              </>
            ) : (
              <>
                <strong>Rupture d'intégrité détectée</strong> à l'entrée #{integrity.brokenAt}. Une ou
                plusieurs lignes du journal ont été modifiées ou supprimées.
              </>
            )}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-surface border border-line rounded-lg p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Rechercher (action, détails, utilisateur)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-line bg-app text-ink"
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm rounded-md border border-line bg-app px-2 py-2 text-ink">
            <option value="">Toutes catégories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="text-sm rounded-md border border-line bg-app px-2 py-2 text-ink">
            <option value="">Tous les utilisateurs</option>
            {users.map((u) => <option key={u.id} value={String(u.id)}>{u.nom}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm rounded-md border border-line bg-app px-2 py-2 text-ink" title="Du" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm rounded-md border border-line bg-app px-2 py-2 text-ink" title="Au" />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={load} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-brand text-white hover:opacity-90">
            <Search className="w-4 h-4" /> Filtrer
          </button>
          <button onClick={resetFilters} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-line text-ink hover:bg-app">
            <RefreshCw className="w-4 h-4" /> Réinitialiser
          </button>
          <div className="flex-1" />
          <button onClick={exportCsv} disabled={events.length === 0} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-line text-ink hover:bg-app disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={exportPdf} disabled={events.length === 0} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-line text-ink hover:bg-app disabled:opacity-50">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Activity className="w-4 h-4 text-brand" />
          <h3 className="font-semibold text-ink">{events.length} événement(s)</h3>
          {loading && <span className="text-xs text-ink-muted">chargement…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted border-b border-line">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Catégorie</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium">Utilisateur</th>
                <th className="px-4 py-2 font-medium">Détails</th>
                <th className="px-4 py-2 font-medium">Empreinte</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-muted">Aucun événement pour ces filtres.</td></tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line/60 hover:bg-app/50">
                  <td className="px-4 py-2 whitespace-nowrap text-ink-muted">{fmt(e.timestamp)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${catColor[e.category] || "bg-gray-100 text-gray-700"}`}>{e.category}</span>
                  </td>
                  <td className="px-4 py-2 text-ink">{e.action}</td>
                  <td className="px-4 py-2">
                    <span className={e.status === "FAILED" ? "text-red-600" : "text-green-600"}>{e.status === "FAILED" ? "Échec" : "OK"}</span>
                  </td>
                  <td className="px-4 py-2 text-ink">{e.userName || (e.userId != null ? `#${e.userId}` : "—")}</td>
                  <td className="px-4 py-2 text-ink-muted max-w-md truncate" title={e.details}>{e.details}</td>
                  <td className="px-4 py-2 font-mono text-xs text-ink-faint">{e.hash || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
