/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Les fichiers téléversés (/uploads/...) sont servis par une route dynamique
  // qui lit le disque à la requête. Indispensable : `next start` fige le contenu
  // de public/ au démarrage, donc un fichier uploadé pendant l'exécution
  // renverrait un 404 (image cassée) via le service statique classique.
  // `beforeFiles` fait passer la réécriture AVANT le service statique.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/uploads/:name", destination: "/api/media/:name" }],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
