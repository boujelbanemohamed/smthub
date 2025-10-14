"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

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
        router.push("/admin")
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-400 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-200 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Retour au hub
            </Link>
          </div>

          <Card className="shadow-2xl bg-gradient-to-br from-white/95 to-blue-50/90 backdrop-blur-sm border-blue-200/50">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-800 via-blue-900 to-slate-800 bg-clip-text text-transparent mb-2">
                Administration
              </CardTitle>
              <div className="h-1 w-20 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full mx-auto mb-4"></div>
              <p className="text-blue-700 text-lg">Connectez-vous pour gérer SMT HUB</p>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-blue-800 font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={credentials.email}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    disabled={loading}
                    className="mt-2 border-blue-200 focus:border-blue-400 bg-white/80"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-blue-800 font-medium">
                    Mot de passe
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                    required
                    disabled={loading}
                    className="mt-2 border-blue-200 focus:border-blue-400 bg-white/80"
                  />
                </div>

                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 shadow-lg"
                  disabled={loading}
                >
                  {loading ? "Connexion..." : "Se connecter"}
                </Button>
              </form>

              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg border border-blue-200/50">
                <p className="text-sm text-blue-700 mb-3 font-medium">Identifiants par défaut :</p>
                <p className="text-sm font-mono bg-white/60 px-3 py-2 rounded border border-blue-200">
                  admin / admin123
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
