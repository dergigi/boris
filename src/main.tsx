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
    
    // Check if already registered/active first
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      if (registrations.length > 0) {
        return registrations[0]
      }
      
      // Not registered yet, try to register
      // In dev mode, use the dev Service Worker for testing
      if (import.meta.env.DEV) {
        const devSwPath = '/sw-dev.js'
        try {
          // Check if dev SW exists
          const response = await fetch(devSwPath)
          const contentType = response.headers.get('content-type') || ''
          const isJavaScript = contentType.includes('javascript') || contentType.includes('application/javascript')
          
          if (response.ok && isJavaScript) {
            return await navigator.serviceWorker.register(devSwPath, { scope: '/' })
          } else {
            console.warn('[sw-registration] Development Service Worker not available')
            return null
          }
        } catch (err) {
          console.warn('[sw-registration] Could not load development Service Worker:', err)
          return null
        }
      } else {
        // In production, just register directly
        return await navigator.serviceWorker.register(swPath)
      }
    })
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
            registration.update()
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

