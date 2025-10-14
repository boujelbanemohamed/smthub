"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ email: "", password: "" })
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
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-r from-[#1877f2] to-[#166fe5] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl font-bold text-white">SMT</span>
          </div>
          <h1 className="text-4xl font-bold text-[#1877f2] mb-2">SMT HUB</h1>
          <p className="text-[#65676b] text-lg">Connectez-vous pour continuer</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg border border-[#dadde1] shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)] p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#1c1e21] mb-2">Se connecter</h2>
            <p className="text-[#65676b]">Accédez à votre portail d'applications</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                id="email"
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 h-12 text-base"
                placeholder="Email ou nom d'utilisateur"
                required
                disabled={loading}
              />
            </div>

            <div>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21] placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:border-[#1877f2] transition-colors duration-200 h-12 text-base"
                placeholder="Mot de passe"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-medium px-4 py-2 rounded-md transition-colors duration-200 h-12 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8 p-4 bg-[#f0f2f5] rounded-lg border border-[#dadde1]">
            <p className="text-sm text-[#65676b] mb-3 font-medium">Comptes de démonstration :</p>
            <div className="space-y-2 text-sm">
              <div className="bg-white px-3 py-2 rounded border border-[#dadde1]">
                <strong className="text-[#1c1e21]">Admin:</strong> <span className="text-[#65676b]">admin@smt.com / admin123</span>
              </div>
              <div className="bg-white px-3 py-2 rounded border border-[#dadde1]">
                <strong className="text-[#1c1e21]">User:</strong> <span className="text-[#65676b]">user@smt.com / user123</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[#8a8d91] text-sm">
              Vous n'avez pas de compte ? Contactez votre administrateur.
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-[#8a8d91] text-xs">
            SMT HUB - Portail d'applications centralisé
          </p>
        </div>
      </div>
    </div>
  )
}
