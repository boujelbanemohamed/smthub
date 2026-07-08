/**
 * Validation utilities for form inputs and user data
 */

export interface ValidationResult {
  valid: boolean
  message?: string
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: false, message: "L'email est requis" }
  }
  
  if (email.length > 254) {
    return { valid: false, message: "L'email est trop long" }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Format d'email invalide" }
  }
  
  return { valid: true }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, message: "Le mot de passe est requis" }
  }
  
  if (password.length < 6) {
    return { valid: false, message: "Le mot de passe doit contenir au moins 6 caractères" }
  }
  
  if (password.length > 128) {
    return { valid: false, message: "Le mot de passe ne peut pas dépasser 128 caractères" }
  }
  
  // Check for at least one letter and one number for stronger passwords
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  
  if (!hasLetter || !hasNumber) {
    return { 
      valid: false, 
      message: "Le mot de passe doit contenir au moins une lettre et un chiffre" 
    }
  }
  
  return { valid: true }
}

/**
 * Validate name field
 */
export function validateName(name: string): ValidationResult {
  if (!name) {
    return { valid: false, message: "Le nom est requis" }
  }
  
  const trimmedName = name.trim()
  
  if (trimmedName.length < 2) {
    return { valid: false, message: "Le nom doit contenir au moins 2 caractères" }
  }
  
  if (trimmedName.length > 100) {
    return { valid: false, message: "Le nom ne peut pas dépasser 100 caractères" }
  }
  
  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/
  if (!nameRegex.test(trimmedName)) {
    return { 
      valid: false, 
      message: "Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes" 
    }
  }
  
  return { valid: true }
}

/**
 * Validate password confirmation
 */
export function validatePasswordConfirmation(
  password: string, 
  confirmPassword: string
): ValidationResult {
  if (!confirmPassword) {
    return { valid: false, message: "La confirmation du mot de passe est requise" }
  }
  
  if (password !== confirmPassword) {
    return { valid: false, message: "Les mots de passe ne correspondent pas" }
  }
  
  return { valid: true }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return ""
  
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
}

/**
 * Validate profile update data
 */
export interface ProfileUpdateData {
  nom: string
  email: string
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

export function validateProfileUpdate(data: ProfileUpdateData): ValidationResult {
  // Validate name
  const nameValidation = validateName(data.nom)
  if (!nameValidation.valid) {
    return nameValidation
  }
  
  // Validate email
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.valid) {
    return emailValidation
  }
  
  // If password change is requested
  if (data.newPassword || data.confirmPassword) {
    if (!data.currentPassword) {
      return { 
        valid: false, 
        message: "Le mot de passe actuel est requis pour changer le mot de passe" 
      }
    }
    
    if (data.newPassword) {
      const passwordValidation = validatePassword(data.newPassword)
      if (!passwordValidation.valid) {
        return passwordValidation
      }
      
      const confirmValidation = validatePasswordConfirmation(
        data.newPassword, 
        data.confirmPassword || ""
      )
      if (!confirmValidation.valid) {
        return confirmValidation
      }
    }
  }
  
  return { valid: true }
}

/**
 * Check if string contains potentially dangerous content
 */
export function containsDangerousContent(input: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ]
  
  return dangerousPatterns.some(pattern => pattern.test(input))
}

/**
 * Rate limiting helper for client-side
 */
export class ClientRateLimit {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map()
  
  check(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
    const now = Date.now()
    const record = this.attempts.get(key)
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs })
      return true
    }
    
    if (record.count >= maxAttempts) {
      return false
    }
    
    record.count++
    return true
  }
  
  reset(key: string): void {
    this.attempts.delete(key)
  }
}

// Export a default instance for convenience
export const clientRateLimit = new ClientRateLimit()
