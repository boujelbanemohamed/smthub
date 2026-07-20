"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Smartphone, Mail, KeyRound, Copy, Check } from "lucide-react"

export interface TwoFAChallenge {
  method: "totp" | "email"
  stage: "totp" | "enroll_totp" | "email"
  pendingToken: string
}

// Écran du second facteur (après mot de passe validé). Gère l'enrôlement TOTP
// (QR code), la saisie du code (app ou email) et l'affichage unique des codes
// de secours en fin d'enrôlement.
export function TwoFactorStep({
  challenge,
  onSuccess,
  onCancel,
}: {
  challenge: TwoFAChallenge
  onSuccess: () => void
  onCancel: () => void
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [enroll, setEnroll] = useState<{ qr: string; secret: string } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)

  // Enrôlement : récupère le QR code au chargement.
  useEffect(() => {
    if (challenge.stage !== "enroll_totp") return
    ;(async () => {
      try {
        const r = await fetch("/api/auth/2fa/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingToken: challenge.pendingToken }),
        })
        const d = await r.json()
        if (r.ok) setEnroll({ qr: d.qr, secret: d.secret })
        else setError(d.error || "Impossible de préparer la configuration.")
      } catch {
        setError("Erreur réseau.")
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const r = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken: challenge.pendingToken, code }),
      })
      const d = await r.json()
      if (r.ok) {
        if (d.backupCodes && d.backupCodes.length > 0) {
          setBackupCodes(d.backupCodes) // à afficher une seule fois
        } else {
          onSuccess()
        }
      } else {
        setError(d.error || "Code incorrect.")
      }
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  // Écran des codes de secours (fin d'enrôlement).
  if (backupCodes) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-700 mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-1">Codes de secours</h2>
        <p className="text-sm text-ink-muted mb-4">
          Conservez ces codes en lieu sûr. Chacun permet de vous connecter une fois si vous perdez
          votre application. Ils ne seront plus affichés.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {backupCodes.map((c) => (
            <code key={c} className="rounded-md bg-app border border-line py-2 font-mono text-sm text-ink">
              {c}
            </code>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(backupCodes.join("\n")).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }}
          className="inline-flex items-center gap-2 text-sm text-brand hover:underline mb-4"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copié" : "Copier les codes"}
        </button>
        <Button onClick={onSuccess} className="w-full bg-brand hover:bg-brand-hover text-white h-12 text-lg font-semibold">
          J'ai noté mes codes, continuer
        </Button>
      </div>
    )
  }

  const isEnroll = challenge.stage === "enroll_totp"
  const isEmail = challenge.method === "email"

  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand/10 text-brand mb-3">
          {isEmail ? <Mail className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>
        <h2 className="text-2xl font-bold text-ink mb-1">Vérification en deux étapes</h2>
        <p className="text-ink-muted text-sm">
          {isEnroll
            ? "Configurez votre application d'authentification pour sécuriser votre compte."
            : isEmail
              ? "Un code à 6 chiffres vient de vous être envoyé par email."
              : "Saisissez le code affiché par votre application d'authentification."}
        </p>
      </div>

      {isEnroll && (
        <div className="mb-5 text-center">
          {enroll ? (
            <>
              <div className="inline-flex items-center gap-2 text-sm text-ink-muted mb-3">
                <Smartphone className="w-4 h-4" /> Scannez ce QR code (Google Authenticator, Authy…)
              </div>
              <div className="flex justify-center mb-3">
                {/* QR en data URL (inline, aucune requête externe) */}
                <Image src={enroll.qr} alt="QR code 2FA" width={200} height={200} className="rounded-lg border border-line" unoptimized />
              </div>
              <p className="text-xs text-ink-faint mb-1">Ou saisissez cette clé manuellement :</p>
              <code className="inline-block rounded-md bg-app border border-line px-3 py-1 font-mono text-sm text-ink break-all">
                {enroll.secret}
              </code>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Préparation…</p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
          placeholder="Code à 6 chiffres"
          maxLength={9}
          required
          autoFocus
          className="h-12 text-center text-2xl tracking-[0.4em] font-mono"
        />
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
        )}
        <Button
          type="submit"
          disabled={loading || (isEnroll && !enroll)}
          className="w-full bg-brand hover:bg-brand-hover text-white h-12 text-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Vérification…" : isEnroll ? "Activer et se connecter" : "Vérifier"}
        </Button>
        <button type="button" onClick={onCancel} className="w-full text-sm text-ink-muted hover:text-ink">
          Annuler
        </button>
        {!isEnroll && (
          <p className="text-center text-xs text-ink-faint">
            Vous pouvez aussi utiliser l'un de vos codes de secours.
          </p>
        )}
      </form>
    </div>
  )
}
