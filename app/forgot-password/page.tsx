"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message || "Si un compte existe, un lien a été envoyé.")
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
          <p className="text-ink-muted text-lg">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-ink mb-2">Mot de passe oublié</h2>
            <p className="text-ink-muted">Saisissez votre email pour recevoir un lien de réinitialisation.</p>
          </div>

          {message ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 h-12 text-base"
                placeholder="Votre adresse email"
                required
                disabled={loading}
              />
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand hover:bg-brand-hover text-white font-semibold px-4 py-2 rounded-md transition-colors duration-200 h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Envoi..." : "Envoyer le lien"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-2 text-brand hover:text-brand-hover text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
