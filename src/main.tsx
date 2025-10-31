import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/tailwind.css'
import './index.css'
import 'react-loading-skeleton/dist/skeleton.css'

// Register Service Worker for PWA functionality
// With injectRegister: null, we need to register manually
// Note: With injectManifest strategy, SW file is only built in production
// So we skip registration in dev mode (image caching won't work in dev, but that's okay)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swPath = '/sw.js'
    
    console.log('[sw-registration] Attempting to register Service Worker:', swPath, {
      isProd: import.meta.env.PROD,
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
      
      // Not registered yet, try to register (production only)
      console.log('[sw-registration] No existing registration, attempting to register:', swPath)
      return await navigator.serviceWorker.register(swPath)
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
      })
  })
} else if (import.meta.env.DEV) {
  // In dev mode, SW registration is skipped (injectManifest requires build)
  console.log('[sw-registration] Skipping Service Worker registration in dev mode (injectManifest requires build)')
} else {
  console.warn('[sw-registration] ⚠️ Service Workers not supported in this browser')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

