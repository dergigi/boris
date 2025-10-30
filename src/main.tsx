import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/tailwind.css'
import './index.css'
import 'react-loading-skeleton/dist/skeleton.css'

// Register Service Worker for PWA functionality
// With injectRegister: null, we need to register manually
// In dev mode with devOptions.enabled, vite-plugin-pwa serves SW at /sw.js (not /dev-sw.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Try to register - in dev mode vite-plugin-pwa serves it via Vite dev server
    // The path should be the same in both dev and prod when using injectManifest
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
      console.log('[sw-registration] No existing registration, attempting to register:', swPath)
      
      // In dev mode, check if file exists first by trying to fetch it
      if (import.meta.env.DEV) {
        try {
          const response = await fetch(swPath, { method: 'HEAD' })
          if (response.ok) {
            console.log('[sw-registration] Service Worker file exists, proceeding with registration')
            return await navigator.serviceWorker.register(swPath)
          } else {
            console.warn('[sw-registration] ⚠️ Service Worker file returned non-OK status:', response.status)
            return null
          }
        } catch (err) {
          console.warn('[sw-registration] ⚠️ Service Worker file not found at:', swPath)
          console.warn('[sw-registration] This is expected in dev mode if vite-plugin-pwa is not serving it')
          console.warn('[sw-registration] Error:', err)
          return null
        }
      } else {
        // In production, just register directly
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
        
        // In dev mode, SW might not be available - this is okay for development
        if (import.meta.env.DEV) {
          console.warn('[sw-registration] ⚠️ Service Worker not available in dev mode - this is expected if vite-plugin-pwa dev server is not running')
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

