import Image from "next/image"

/**
 * Logo Monétique Tunisie sur badge blanc (lisible en thème clair comme sombre).
 * `height` contrôle la taille rendue ; le ratio est conservé.
 */
export function BrandLogo({ height = 32, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 588) / 258)
  return (
    <span className={`inline-flex items-center justify-center bg-white rounded-md px-2 py-1 ${className}`}>
      <Image
        src="/monetique-logo.png"
        alt="Monétique Tunisie"
        width={width}
        height={height}
        priority
        style={{ height, width: "auto" }}
      />
    </span>
  )
}
