import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/tailwind.css'
import './index.css'
import 'react-loading-skeleton/dist/skeleton.css'

// Register Service Worker for PWA functionality
// With injectRegister: null, we need to register manually
// With devOptions.enabled: true, vite-plugin-pwa serves SW in dev mode too
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = '/sw.js'
    
    console.log('[sw-registration] Attempting to register Service Worker:', swPath, {
      isProd: import.meta.env.PROD,
      isDev: import.meta.env.DEV,
      hasController: !!navigator.serviceWorker.controller
    })
    
    // Check if already registered/active first
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      console.log('[sw-registration] Existing registrations:', registrations.length)
      
      if (registrations.length > 0) {
        const existingReg = registrations[0]
        console.log('[sw-registration] Service Worker already registered:', {
          scope: existingReg.scope,
          active: !!existingReg.active,
          installing: !!existingReg.installing,
          waiting: !!existingReg.waiting,
          controller: !!navigator.serviceWorker.controller
        })
        
        if (existingReg.active) {
          console.log('[sw-registration] ✅ Service Worker is active')
        }
        return existingReg
      }
      
      // Not registered yet, try to register
      // In dev mode, check if SW file exists and has correct MIME type before registering
      if (import.meta.env.DEV) {
        try {
          const response = await fetch(swPath)
          const contentType = response.headers.get('content-type') || ''
          const isJavaScript = contentType.includes('javascript') || contentType.includes('application/javascript')
          
          console.log('[sw-registration] Dev mode - checking SW file:', {
            status: response.status,
            contentType,
            isJavaScript,
            isHTML: contentType.includes('text/html')
          })
          
          if (response.ok && isJavaScript) {
            console.log('[sw-registration] Service Worker file available in dev mode, proceeding with registration')
            return await navigator.serviceWorker.register(swPath)
          } else {
            console.warn('[sw-registration] ⚠️ Service Worker file not available in dev mode:', {
              status: response.status,
              contentType
            })
            console.warn('[sw-registration] Image caching will not work in dev mode - test in production build')
            return null
          }
        } catch (err) {
          console.warn('[sw-registration] ⚠️ Could not check Service Worker file in dev mode:', err)
          console.warn('[sw-registration] Image caching will not work in dev mode - test in production build')
          return null
        }
      } else {
        // In production, just register directly
        console.log('[sw-registration] No existing registration, attempting to register:', swPath)
        return await navigator.serviceWorker.register(swPath)
      }
    })
      .then(registration => {
        if (!registration) return
        
        console.log('[sw-registration] ✅ Service Worker registration successful:', {
          scope: registration.scope,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          controller: !!navigator.serviceWorker.controller
        })
        
        // Wait for Service Worker to activate
        if (registration.active) {
          console.log('[sw-registration] Service Worker is already active and controlling page')
        } else if (registration.installing) {
          console.log('[sw-registration] Service Worker is installing...')
          registration.installing.addEventListener('statechange', () => {
            const state = registration.installing?.state
            console.log('[sw-registration] Service Worker state changed:', state)
            if (state === 'activated') {
              console.log('[sw-registration] ✅ Service Worker activated and ready')
            }
          })
        } else if (registration.waiting) {
          console.log('[sw-registration] Service Worker is waiting to activate')
        }
        
        // Check for updates periodically (production only)
        if (import.meta.env.PROD) {
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
        }
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          console.log('[sw-registration] Service Worker update found')
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('[sw-registration] New Service Worker state:', newWorker.state)
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                const updateAvailable = new CustomEvent('sw-update-available')
                window.dispatchEvent(updateAvailable)
              }
            })
          }
        })
      })
      .catch(error => {
        console.error('[sw-registration] ❌ Service Worker registration failed:', error)
        console.error('[sw-registration] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        })
        
        // In dev mode, this is expected if vite-plugin-pwa isn't serving the SW
        if (import.meta.env.DEV) {
          console.warn('[sw-registration] ⚠️ This is expected in dev mode if vite-plugin-pwa is not serving the SW file')
          console.warn('[sw-registration] Image caching will not work in dev mode - test in production build')
        }
      })
  })
} else {
  console.warn('[sw-registration] ⚠️ Service Workers not supported in this browser')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

