"use client"

import type React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Eye, EyeOff } from "lucide-react"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-app" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") || ""

  const [status, setStatus] = useState<"checking" | "valid" | "invalid" | "done">("checking")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus("invalid")
      return
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.valid) {
          setEmail(d.email || "")
          setStatus("valid")
        } else {
          setStatus("invalid")
        }
      })
      .catch(() => setStatus("invalid"))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("done")
        setTimeout(() => router.push("/login"), 2500)
      } else {
        setError(data.error || "Une erreur est survenue.")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl px-6 py-4 mb-6 shadow-md">
            <Image src="/monetique-logo.png" alt="Monétique Tunisie" width={280} height={123} priority className="h-auto w-[240px]" />
          </div>
          <p className="text-ink-muted text-lg">Définir un nouveau mot de passe</p>
        </div>

        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8">
          {status === "checking" && <p className="text-center text-ink-muted">Vérification du lien...</p>}

          {status === "invalid" && (
            <div className="text-center space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                Ce lien est invalide ou a expiré.
              </div>
              <Link href="/forgot-password" className="inline-block text-brand hover:text-brand-hover font-medium">
                Demander un nouveau lien
              </Link>
            </div>
          )}

          {status === "done" && (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                Mot de passe mis à jour ! Redirection vers la connexion...
              </div>
              <Link href="/login" className="inline-block text-brand hover:text-brand-hover font-medium">
                Se connecter maintenant
              </Link>
            </div>
          )}

          {status === "valid" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {email && <p className="text-sm text-ink-muted text-center mb-2">Compte : <strong className="text-ink">{email}</strong></p>}
              <div>
                <label className="text-ink font-medium text-sm">Nouveau mot de passe</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-11 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 h-12"
                    placeholder="Au moins 6 caractères"
                    required
                    minLength={6}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-faint hover:text-ink transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-ink font-medium text-sm">Confirmer le mot de passe</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 h-12"
                  placeholder="Confirmez le mot de passe"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand hover:bg-brand-hover text-white font-semibold px-4 py-2 rounded-md transition-colors duration-200 h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Enregistrement..." : "Définir le mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
