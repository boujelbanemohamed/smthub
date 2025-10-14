interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  text = "Chargement...", 
  className = "" 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-16 w-16'
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-4 border-[#1877f2] border-t-transparent ${sizeClasses[size]} mb-4`} />
      {text && (
        <p className={`text-[#1c1e21] ${textSizes[size]} font-medium`}>
          {text}
        </p>
      )}
    </div>
  )
}

// Composant de chargement pour les pages complètes
export function PageLoader() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}

// Composant de chargement pour les sections
export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="md" />
    </div>
  )
}

// Composant de chargement pour les boutons
export function ButtonLoader({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center space-x-2">
      <LoadingSpinner size={size} text="" />
      <span>Chargement...</span>
    </div>
  )
} 