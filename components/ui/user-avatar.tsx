"use client"

import { useState } from "react"

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase()
}

/**
 * Avatar utilisateur. La valeur `avatar` peut être :
 *  - une URL d'image téléversée (`/uploads/...`) ou externe (`http...`)
 *  - une couleur de préréglage (`color:#1877f2`) → initiales sur fond coloré
 *  - vide/undefined → cercle de marque par défaut avec initiales
 */
export function UserAvatar({
  name,
  avatar,
  size = 40,
  className = "",
}: {
  name: string
  avatar?: string | null
  size?: number
  className?: string
}) {
  const [imgError, setImgError] = useState(false)
  const isImage = !!avatar && (avatar.startsWith("/uploads/") || avatar.startsWith("http") || avatar.startsWith("data:image/"))
  const color = avatar && avatar.startsWith("color:") ? avatar.slice("color:".length) : "#1877f2"

  if (isImage && !imgError) {
    // <img> volontaire (et non next/image) : sert les fichiers de /public/uploads
    // sans configuration de domaines.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar as string}
        alt={name}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-semibold select-none ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  )
}
