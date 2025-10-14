"use client"

import { useEffect } from 'react'
import { preloadCriticalData } from '@/lib/optimized-data'

interface PreloaderProps {
  children: React.ReactNode
}

export function Preloader({ children }: PreloaderProps) {
  useEffect(() => {
    // Précharger les données critiques en arrière-plan
    preloadCriticalData()
  }, [])

  return <>{children}</>
}

// Hook pour précharger des données spécifiques
export function usePreloadData() {
  useEffect(() => {
    // Précharger les données les plus utilisées
    const preloadData = async () => {
      try {
        // Précharger les applications et utilisateurs en arrière-plan
        await Promise.all([
          fetch('/api/applications').catch(() => {}),
          fetch('/api/users').catch(() => {})
        ])
      } catch (error) {
        // Ignorer les erreurs de préchargement
        console.debug('Erreur de préchargement ignorée:', error)
      }
    }

    // Délai pour ne pas bloquer le rendu initial
    const timer = setTimeout(preloadData, 1000)
    return () => clearTimeout(timer)
  }, [])
}

// Composant pour précharger les images
export function ImagePreloader() {
  useEffect(() => {
    const preloadImages = () => {
      const imageUrls = [
        '/placeholder.svg?height=64&width=64&text=Gmail',
        '/placeholder.svg?height=64&width=64&text=Drive',
        '/placeholder.svg?height=64&width=64&text=Slack'
      ]

      imageUrls.forEach(url => {
        const img = new Image()
        img.src = url
      })
    }

    // Précharger les images après le rendu initial
    const timer = setTimeout(preloadImages, 2000)
    return () => clearTimeout(timer)
  }, [])

  return null
} 