export type Theme = 'dark' | 'light' | 'system'
export type DarkColorTheme = 'black' | 'midnight' | 'charcoal'
export type LightColorTheme = 'paper-white' | 'sepia' | 'ivory'

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

/**
 * Get the system's current theme preference
 */
export function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Apply theme and color variant to the document root element
 * Handles 'system' theme by listening to OS preference changes
 */
export function applyTheme(
  theme: Theme,
  darkColorTheme: DarkColorTheme = 'midnight',
  lightColorTheme: LightColorTheme = 'sepia'
): void {
  const root = document.documentElement
  
  // Remove existing theme classes
  root.classList.remove('theme-dark', 'theme-light', 'theme-system')
  // Remove existing color theme classes
  root.classList.remove('dark-black', 'dark-midnight', 'dark-charcoal')
  root.classList.remove('light-paper-white', 'light-sepia', 'light-ivory')
  
  // Clean up previous media query listener if exists
  if (mediaQueryListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener)
    mediaQueryListener = null
  }
  
  if (theme === 'system') {
    root.classList.add('theme-system')
    
    // Apply color themes for system mode (CSS will handle media query)
    root.classList.add(`dark-${darkColorTheme}`)
    root.classList.add(`light-${lightColorTheme}`)
    
    // Listen for system theme changes
    mediaQueryListener = (e: MediaQueryListEvent) => {
      // The CSS media query handles the color changes automatically
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener)
  } else {
    root.classList.add(`theme-${theme}`)
    // Apply appropriate color theme based on light/dark
    if (theme === 'dark') {
      root.classList.add(`dark-${darkColorTheme}`)
    } else {
      root.classList.add(`light-${lightColorTheme}`)
    }
  }
  
}
