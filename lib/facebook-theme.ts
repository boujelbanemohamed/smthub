// Facebook-inspired color palette and design system

export const facebookColors = {
  // Primary Facebook Blue
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#1877f2', // Facebook Blue
    600: '#1565c0',
    700: '#0d47a1',
    800: '#0a3d91',
    900: '#042a5c',
  },
  
  // Facebook Secondary Colors
  secondary: {
    50: '#f3f4f6',
    100: '#e5e7eb',
    200: '#d1d5db',
    300: '#9ca3af',
    400: '#6b7280',
    500: '#4b5563',
    600: '#374151',
    700: '#1f2937',
    800: '#111827',
    900: '#0f172a',
  },
  
  // Facebook Green (for success states)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  
  // Facebook Red (for errors/notifications)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  // Facebook Orange (for warnings)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  // Facebook Background Colors
  background: {
    primary: '#ffffff',
    secondary: '#f0f2f5', // Facebook's light gray background
    tertiary: '#e4e6ea',
    dark: '#18191a', // Facebook dark mode
    darkSecondary: '#242526',
  },
  
  // Facebook Text Colors
  text: {
    primary: '#1c1e21', // Facebook's main text color
    secondary: '#65676b', // Facebook's secondary text
    tertiary: '#8a8d91',
    inverse: '#ffffff',
    link: '#1877f2',
    linkHover: '#166fe5',
  },
  
  // Facebook Border Colors
  border: {
    light: '#dadde1',
    medium: '#ced0d4',
    dark: '#8a8d91',
  }
}

export const facebookShadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  xl: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  facebook: '0 2px 4px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.1)', // Facebook card shadow
}

export const facebookBorderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  facebook: '8px', // Facebook's standard border radius
}

export const facebookSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
}

export const facebookFonts = {
  primary: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  }
}

// Facebook-style component classes
export const facebookClasses = {
  // Buttons
  button: {
    primary: `
      bg-[#1877f2] hover:bg-[#166fe5] text-white font-medium px-4 py-2 rounded-md
      transition-colors duration-200 shadow-sm hover:shadow-md
      focus:outline-none focus:ring-2 focus:ring-[#1877f2] focus:ring-offset-2
    `,
    secondary: `
      bg-[#e4e6ea] hover:bg-[#d8dadf] text-[#1c1e21] font-medium px-4 py-2 rounded-md
      transition-colors duration-200 shadow-sm hover:shadow-md
      focus:outline-none focus:ring-2 focus:ring-[#e4e6ea] focus:ring-offset-2
    `,
    success: `
      bg-[#42b883] hover:bg-[#369870] text-white font-medium px-4 py-2 rounded-md
      transition-colors duration-200 shadow-sm hover:shadow-md
      focus:outline-none focus:ring-2 focus:ring-[#42b883] focus:ring-offset-2
    `,
    danger: `
      bg-[#e41e3f] hover:bg-[#d01739] text-white font-medium px-4 py-2 rounded-md
      transition-colors duration-200 shadow-sm hover:shadow-md
      focus:outline-none focus:ring-2 focus:ring-[#e41e3f] focus:ring-offset-2
    `,
  },
  
  // Cards
  card: `
    bg-white rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]
    border border-[#dadde1] transition-shadow duration-200 hover:shadow-lg
  `,
  
  // Inputs
  input: `
    w-full px-3 py-2 border border-[#dadde1] rounded-md bg-white text-[#1c1e21]
    placeholder-[#8a8d91] focus:outline-none focus:ring-2 focus:ring-[#1877f2]
    focus:border-[#1877f2] transition-colors duration-200
  `,
  
  // Navigation
  nav: `
    bg-white border-b border-[#dadde1] shadow-sm
  `,
  
  // Background
  background: {
    primary: 'bg-white',
    secondary: 'bg-[#f0f2f5]',
    tertiary: 'bg-[#e4e6ea]',
  },
  
  // Text
  text: {
    primary: 'text-[#1c1e21]',
    secondary: 'text-[#65676b]',
    tertiary: 'text-[#8a8d91]',
    link: 'text-[#1877f2] hover:text-[#166fe5]',
  }
}

// Utility function to get Facebook-style gradient
export const getFacebookGradient = (opacity = 1) => {
  return `linear-gradient(135deg, rgba(24, 119, 242, ${opacity}) 0%, rgba(22, 111, 229, ${opacity}) 100%)`
}

// Utility function to get Facebook-style box shadow
export const getFacebookShadow = (level: 'sm' | 'md' | 'lg' | 'xl' | 'facebook' = 'facebook') => {
  return facebookShadows[level]
}
