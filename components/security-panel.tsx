"use client"

import { useEffect, useState } from "react"
import { Shield, Lock, KeyRound, Unlock, Save, CheckCircle2, AlertCircle } from "lucide-react"

interface SecurityConfig {
  passwordPolicy: {
    enabled: boolean
    minLength: number
    requireUpper: boolean
    requireLower: boolean
    requireDigit: boolean
    requireSpecial: boolean
    expiryDays: number
    historyCount: number
    graceHours: number
  }
  lockout: { enabled: boolean; maxAttempts: number; lockMinutes: number }
  twoFactor: { totpEnabled: boolean; emailEnabled: boolean }
}

// Panneau « Sécurité ». Configuration réservée au super-admin ; la section de
// déverrouillage des comptes est aussi accessible aux admins de banque (pour
// les comptes de leur banque).
type ModalKind = "success" | "info" | "error"

export function SecurityPanel({ isSuper }: { isSuper: boolean }) {
  const [config, setConfig] = useState<SecurityConfig | null>(null)
  // Instantané de la dernière configuration enregistrée : sert à détecter
  // l'absence de modification lors du clic sur « Enregistrer ».
  const [savedSnapshot, setSavedSnapshot] = useState<string>("")
  const [locked, setLocked] = useState<{ email: string; minutesLeft: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  // Pop-up (modal) de résultat d'enregistrement.
  const [modal, setModal] = useState<{ kind: ModalKind; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const loadConfig = async () => {
    if (!isSuper) return
    try {
      const r = await fetch("/api/admin/security")
      if (r.ok) {
        const cfg = (await r.json()).config
        setConfig(cfg)
        setSavedSnapshot(JSON.stringify(cfg))
      }
    } catch { /* silencieux */ }
  }
  const loadLocks = async () => {
    try {
      const r = await fetch("/api/admin/security/locks")
      if (r.ok) setLocked((await r.json()).locked || [])
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    loadConfig()
    loadLocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!config) return
    // Aucune modification depuis le dernier enregistrement → pop-up d'information.
    if (JSON.stringify(config) === savedSnapshot) {
      setModal({ kind: "info", msg: "Aucune modification à enregistrer." })
      return
    }
    setSaving(true)
    try {
      const r = await fetch("/api/admin/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setConfig(d.config)
        setSavedSnapshot(JSON.stringify(d.config))
        setModal({ kind: "success", msg: "Les paramètres de sécurité ont bien été enregistrés." })
      } else {
        setModal({ kind: "error", msg: d.error || "Échec de l'enregistrement des paramètres." })
      }
    } catch {
      setModal({ kind: "error", msg: "Erreur réseau : les paramètres n'ont pas pu être enregistrés." })
    } finally {
      setSaving(false)
    }
  }

  const unlock = async (email: string) => {
    try {
      const r = await fetch("/api/admin/security/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (r.ok) {
        showToast(true, `Compte ${email} déverrouillé.`)
        loadLocks()
      } else {
        const d = await r.json()
        showToast(false, d.error || "Échec du déverrouillage.")
      }
    } catch {
      showToast(false, "Erreur réseau.")
    }
  }

  const pp = config?.passwordPolicy
  const lo = config?.lockout
  const tf = config?.twoFactor

  const setPP = (patch: Partial<NonNullable<typeof pp>>) =>
    setConfig((c) => (c ? { ...c, passwordPolicy: { ...c.passwordPolicy, ...patch } } : c))
  const setLO = (patch: Partial<NonNullable<typeof lo>>) =>
    setConfig((c) => (c ? { ...c, lockout: { ...c.lockout, ...patch } } : c))
  const setTF = (patch: Partial<NonNullable<typeof tf>>) =>
    setConfig((c) => (c ? { ...c, twoFactor: { ...c.twoFactor, ...patch } } : c))

  return (
    <div className="space-y-6">
      {/* Pop-up de résultat d'enregistrement */}
      {modal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-surface border border-line shadow-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              {modal.kind === "success" && <CheckCircle2 className="w-12 h-12 text-green-600" />}
              {modal.kind === "info" && <AlertCircle className="w-12 h-12 text-amber-500" />}
              {modal.kind === "error" && <AlertCircle className="w-12 h-12 text-red-600" />}
            </div>
            <h3 className="text-lg font-bold text-ink mb-1">
              {modal.kind === "success" ? "Enregistré" : modal.kind === "info" ? "Aucune modification" : "Erreur"}
            </h3>
            <p className="text-sm text-ink-muted mb-5">{modal.msg}</p>
            <button
              onClick={() => setModal(null)}
              className="px-5 py-2 rounded-lg bg-brand text-white font-medium hover:opacity-90"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            toast.ok
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Comptes verrouillés (super-admin + admin de banque) */}
      <section className="bg-surface border border-line rounded-lg p-5 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 mb-3">
          <Unlock className="w-5 h-5 text-brand" />
          <h3 className="text-lg font-bold text-ink">Comptes verrouillés</h3>
        </div>
        {locked.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun compte verrouillé actuellement.</p>
        ) : (
          <ul className="divide-y divide-line">
            {locked.map((l) => (
              <li key={l.email} className="flex items-center justify-between py-2">
                <span className="text-sm text-ink">
                  {l.email}{" "}
                  <span className="text-ink-muted">— déverrouillage auto dans {l.minutesLeft} min</span>
                </span>
                <button
                  onClick={() => unlock(l.email)}
                  className="text-xs px-3 py-1.5 rounded-md bg-brand text-white hover:opacity-90"
                >
                  Déverrouiller
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isSuper && (
        <p className="text-sm text-ink-muted">
          La configuration des politiques de sécurité est réservée au super-administrateur.
        </p>
      )}

      {isSuper && config && (
        <>
          {/* Verrouillage de compte */}
          <section className="bg-surface border border-line rounded-lg p-5 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-ink">Verrouillage après échecs de connexion</h3>
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={lo!.enabled} onChange={(e) => setLO({ enabled: e.target.checked })} />
              <span className="text-sm text-ink">Activer le verrouillage automatique</span>
            </label>
            <div className={`grid sm:grid-cols-2 gap-4 ${lo!.enabled ? "" : "opacity-50 pointer-events-none"}`}>
              <Field label="Nombre de tentatives avant verrouillage">
                <input type="number" min={1} max={50} value={lo!.maxAttempts}
                  onChange={(e) => setLO({ maxAttempts: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Durée du verrouillage (minutes)">
                <input type="number" min={1} max={1440} value={lo!.lockMinutes}
                  onChange={(e) => setLO({ lockMinutes: Number(e.target.value) })} className={inputCls} />
              </Field>
            </div>
            <p className="text-xs text-ink-faint mt-3">
              Après ce nombre d'échecs, le compte est verrouillé. Déverrouillage automatique après le délai,
              ou manuel par un administrateur ci-dessus.
            </p>
          </section>

          {/* Politique de mot de passe */}
          <section className="bg-surface border border-line rounded-lg p-5 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-ink">Politique de mot de passe</h3>
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={pp!.enabled} onChange={(e) => setPP({ enabled: e.target.checked })} />
              <span className="text-sm text-ink">Activer la politique de mot de passe</span>
            </label>
            <div className={`space-y-4 ${pp!.enabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Longueur minimale">
                  <input type="number" min={6} max={64} value={pp!.minLength}
                    onChange={(e) => setPP({ minLength: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Expiration (jours, 0 = jamais)">
                  <input type="number" min={0} max={3650} value={pp!.expiryDays}
                    onChange={(e) => setPP({ expiryDays: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Interdiction de réutilisation (N derniers, 0 = off)">
                  <input type="number" min={0} max={24} value={pp!.historyCount}
                    onChange={(e) => setPP({ historyCount: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Délai de mise en conformité (heures)">
                  <input type="number" min={1} max={720} value={pp!.graceHours}
                    onChange={(e) => setPP({ graceHours: Number(e.target.value) })} className={inputCls} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-4">
                <Check label="Majuscule requise" checked={pp!.requireUpper} onChange={(v) => setPP({ requireUpper: v })} />
                <Check label="Minuscule requise" checked={pp!.requireLower} onChange={(v) => setPP({ requireLower: v })} />
                <Check label="Chiffre requis" checked={pp!.requireDigit} onChange={(v) => setPP({ requireDigit: v })} />
                <Check label="Caractère spécial requis" checked={pp!.requireSpecial} onChange={(v) => setPP({ requireSpecial: v })} />
              </div>
              <p className="text-xs text-ink-faint">
                Les utilisateurs dont le mot de passe n'est pas conforme (ou expiré) sont invités à le changer sous{" "}
                {pp!.graceHours}h ; passé ce délai, leur compte est désactivé automatiquement.
              </p>
            </div>
          </section>

          {/* Double authentification (2FA) — préparé, activation dans le lot suivant */}
          <section className="bg-surface border border-line rounded-lg p-5 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-ink">Double authentification (2FA)</h3>
            </div>
            <div className="flex flex-wrap gap-4">
              <Check label="Application d'authentification (TOTP)" checked={tf!.totpEnabled} onChange={(v) => setTF({ totpEnabled: v })} />
              <Check label="Code par email" checked={tf!.emailEnabled} onChange={(v) => setTF({ emailEnabled: v })} />
            </div>
            <p className="text-xs text-ink-faint mt-3">
              Désactivées par défaut. Le super-administrateur choisit ici la ou les méthodes appliquées à
              l'ensemble des utilisateurs.
            </p>
          </section>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white font-medium hover:opacity-90 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const inputCls =
  "w-full rounded-md border border-line bg-app px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-muted mb-1">{label}</span>
      {children}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-ink">{label}</span>
    </label>
  )
}
