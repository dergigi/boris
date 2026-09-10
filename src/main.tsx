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
    
    const register = async () => {
      if (import.meta.env.DEV) {
        return navigator.serviceWorker.register('/dev-sw.js?dev-sw', { type: 'module', scope: '/' })
      }
      // Register on every load so old/dev workers migrate to the current script.
      return navigator.serviceWorker.register(swPath)
    }
    register()
      .then(registration => {
        if (!registration) return
        
        // Wait for Service Worker to activate
        if (registration.installing) {
          registration.installing.addEventListener('statechange', () => {
            // Service Worker state changed
          })
        }
        
        // Check for updates periodically (production only)
        if (import.meta.env.PROD) {
          setInterval(() => {
            registration.update().catch(error => console.warn('[sw-registration] Update check failed:', error))
          }, 60 * 60 * 1000) // Check every hour
        }
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
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

