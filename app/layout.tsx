import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Preloader } from "@/components/preloader"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SMT HUB - Portail d'applications",
  description: "Votre portail centralisé pour accéder à toutes vos applications",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Preloader>
          {children}
        </Preloader>
      </body>
    </html>
  )
}
