"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ email: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      })

      if (res.ok) {
        router.push("/")
      } else {
        const data = await res.json()
        setError(data.error || "Identifiants incorrects")
      }
    } catch (error) {
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
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl px-6 py-4 mb-6 shadow-md">
            <Image
              src="/monetique-logo.png"
              alt="Monétique Tunisie"
              width={280}
              height={123}
              priority
              className="h-auto w-[240px]"
            />
          </div>
          <p className="text-ink-muted text-lg">Connectez-vous pour continuer</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface rounded-lg border border-line shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-ink mb-2">Se connecter</h2>
            <p className="text-ink-muted">Accédez à votre portail d'applications</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                id="email"
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 h-12 text-base"
                placeholder="Email ou nom d'utilisateur"
                required
                disabled={loading}
              />
            </div>

            <div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-11 border border-line rounded-md bg-surface text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-200 h-12 text-base"
                  placeholder="Mot de passe"
                  required
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

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 h-12 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          {/* Mot de passe oublié */}
          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-brand hover:text-brand-hover text-sm font-medium">
              Mot de passe oublié ?
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-ink-faint text-sm">
              Vous n'avez pas de compte ? Contactez votre administrateur.
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-ink-faint text-xs">
            SMT HUB - Portail d'applications centralisé
          </p>
        </div>
      </div>
    </div>
  )
}
