"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Évite le mismatch d'hydratation : on n'affiche l'icône qu'après le montage.
  React.useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-line bg-surface text-ink hover:bg-surface-muted transition-colors duration-200 ${className}`}
    >
      {mounted && isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
