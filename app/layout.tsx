import type React from "react"
import type { Metadata } from "next"
// Police locale (fournie par le package `geist`) : aucune requête réseau au
// build, contrairement à `next/font/google` qui télécharge Inter depuis Google
// Fonts et fait échouer le build sans connexion Internet.
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { Preloader } from "@/components/preloader"
import { ThemeProvider } from "@/components/theme-provider"
import { InactivityLogout } from "@/components/inactivity-logout"

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
    <html lang="fr" suppressHydrationWarning>
      <body className={GeistSans.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <Preloader>
            {children}
          </Preloader>
          <InactivityLogout />
        </ThemeProvider>
      </body>
    </html>
  )
}
