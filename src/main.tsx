import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/tailwind.css'
import './index.css'
import 'react-loading-skeleton/dist/skeleton.css'

// Register Service Worker for PWA functionality
// Enable in both dev and prod (devOptions.enabled is true in vite.config)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = import.meta.env.PROD ? '/sw.js' : '/dev-sw.js?dev-sw'
    console.log('[sw-registration] Registering Service Worker:', swPath, {
      isProd: import.meta.env.PROD,
      isDev: import.meta.env.DEV
    })
    
    navigator.serviceWorker
      .register(swPath)
      .then(registration => {
        console.log('[sw-registration] ✅ Service Worker registered:', {
          scope: registration.scope,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting
        })
        
        // Wait for Service Worker to activate
        if (registration.active) {
          console.log('[sw-registration] Service Worker is already active')
        } else if (registration.installing) {
          registration.installing.addEventListener('statechange', () => {
            console.log('[sw-registration] Service Worker state:', registration.installing?.state)
            if (registration.installing?.state === 'activated') {
              console.log('[sw-registration] ✅ Service Worker activated and ready')
            }
          })
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

