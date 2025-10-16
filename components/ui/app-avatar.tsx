"use client"

import { useState } from "react"
import Image from "next/image"

interface Application {
  id: number
  nom: string
  image_url: string
  app_url: string
  ordre_affichage: number
}

// Composant pour l'avatar d'application avec fallback
export function AppAvatar({ app, size = 80 }: { app: Application, size?: number }) {
  const [imageError, setImageError] = useState(false)

  // Fonction pour générer une couleur basée sur le nom
  const getAvatarColor = (name: string) => {
    const colors = [
      '#1877f2', '#42b883', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // Fonction pour obtenir les initiales
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  if (!app.image_url || imageError) {
    const backgroundColor = getAvatarColor(app.nom)
    const initials = getInitials(app.nom)

    return (
      <div
        className="flex items-center justify-center rounded-xl text-white font-bold shadow-md"
        style={{
          width: size,
          height: size,
          backgroundColor,
          fontSize: size * 0.35
        }}
      >
        {initials}
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={app.image_url}
        alt={app.nom}
        fill
        className="object-contain rounded-xl shadow-md"
        sizes={`${size}px`}
        onError={() => setImageError(true)}
      />
    </div>
  )
}