export type Theme = 'dark' | 'light' | 'system'

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

/**
 * Get the system's current theme preference
 */
export function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Apply theme to the document root element
 * Handles 'system' theme by listening to OS preference changes
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  
  // Remove existing theme classes
  root.classList.remove('theme-dark', 'theme-light', 'theme-system')
  
  // Clean up previous media query listener if exists
  if (mediaQueryListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener)
    mediaQueryListener = null
  }
  
  if (theme === 'system') {
    root.classList.add('theme-system')
    
    // Listen for system theme changes
    mediaQueryListener = (e: MediaQueryListEvent) => {
      console.log('🎨 System theme changed to:', e.matches ? 'dark' : 'light')
      // The CSS media query handles the color changes
      // We just need to update localStorage for no-FOUC on next load
      localStorage.setItem('theme-system-current', e.matches ? 'dark' : 'light')
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener)
    
    // Store current system theme for no-FOUC on next boot
    localStorage.setItem('theme-system-current', getSystemTheme())
  } else {
    root.classList.add(`theme-${theme}`)
  }
  
  // Persist to localStorage for early boot application
  localStorage.setItem('theme', theme)
  
  console.log('🎨 Applied theme:', theme)
}

/**
 * Get the current theme from localStorage or default to 'system'
 */
export function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored
  }
  return 'system'
}

