"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Eye, Edit, Shield, X } from "lucide-react"

export type AccessLevel = "read" | "write" | "admin" | "none"

interface AccessLevelSelectorProps {
  currentLevel: AccessLevel
  onLevelChange: (level: AccessLevel) => void
  disabled?: boolean
  size?: "sm" | "md" | "lg"
}

const accessLevels = [
  {
    value: "none" as AccessLevel,
    label: "Aucun accès",
    description: "L'utilisateur ne peut pas accéder à l'application",
    icon: X,
    color: "bg-gray-100 text-gray-700 border-gray-300",
    badgeVariant: "secondary" as const
  },
  {
    value: "read" as AccessLevel,
    label: "Lecture seule",
    description: "L'utilisateur peut consulter mais pas modifier",
    icon: Eye,
    color: "bg-blue-100 text-blue-700 border-blue-300",
    badgeVariant: "outline" as const
  },
  {
    value: "write" as AccessLevel,
    label: "Lecture/Écriture",
    description: "L'utilisateur peut consulter et modifier",
    icon: Edit,
    color: "bg-green-100 text-green-700 border-green-300",
    badgeVariant: "default" as const
  },
  {
    value: "admin" as AccessLevel,
    label: "Administrateur",
    description: "L'utilisateur a tous les droits sur l'application",
    icon: Shield,
    color: "bg-purple-100 text-purple-700 border-purple-300",
    badgeVariant: "destructive" as const
  }
]

export function AccessLevelSelector({ 
  currentLevel, 
  onLevelChange, 
  disabled = false,
  size = "md" 
}: AccessLevelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const currentLevelData = accessLevels.find(level => level.value === currentLevel)
  const CurrentIcon = currentLevelData?.icon || X

  const handleLevelChange = (value: string) => {
    onLevelChange(value as AccessLevel)
    setIsOpen(false)
  }

  return (
    <div className="w-full">
      <Select 
        value={currentLevel} 
        onValueChange={handleLevelChange}
        disabled={disabled}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger 
          className={`
            ${size === "sm" ? "h-8 text-xs" : size === "lg" ? "h-12 text-base" : "h-10 text-sm"}
            ${currentLevelData?.color || "bg-gray-100 text-gray-700 border-gray-300"}
            transition-all duration-200 hover:shadow-sm
          `}
        >
          <div className="flex items-center gap-2">
            <CurrentIcon className={`${size === "sm" ? "w-3 h-3" : "w-4 h-4"}`} />
            <SelectValue>
              <span className="font-medium">{currentLevelData?.label || "Sélectionner"}</span>
            </SelectValue>
          </div>
        </SelectTrigger>
        
        <SelectContent className="w-80">
          {accessLevels.map((level) => {
            const Icon = level.icon
            const isSelected = level.value === currentLevel
            
            return (
              <SelectItem 
                key={level.value} 
                value={level.value}
                className={`
                  p-3 cursor-pointer transition-all duration-200
                  ${isSelected ? level.color : "hover:bg-gray-50"}
                `}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon className={`w-5 h-5 mt-0.5 ${
                    isSelected ? "text-current" : "text-gray-500"
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{level.label}</span>
                      {isSelected && (
                        <Badge 
                          variant={level.badgeVariant}
                          className="text-xs px-1.5 py-0.5"
                        >
                          Actuel
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {level.description}
                    </p>
                  </div>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      
      {/* Current level info */}
      {currentLevelData && (
        <div className="mt-2 text-xs text-gray-600">
          {currentLevelData.description}
        </div>
      )}
    </div>
  )
}

export function AccessLevelBadge({ level, size = "sm" }: { level: AccessLevel, size?: "sm" | "md" }) {
  const levelData = accessLevels.find(l => l.value === level)
  if (!levelData) return null
  
  const Icon = levelData.icon
  
  return (
    <Badge 
      variant={levelData.badgeVariant}
      className={`
        ${levelData.color} 
        ${size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}
        flex items-center gap-1.5 font-medium
      `}
    >
      <Icon className={size === "md" ? "w-4 h-4" : "w-3 h-3"} />
      {levelData.label}
    </Badge>
  )
}

export { accessLevels }
