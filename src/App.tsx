import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { EventStoreProvider, AccountsProvider, Hooks } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager, Accounts } from 'applesauce-accounts'
import { registerCommonAccountTypes } from 'applesauce-accounts/accounts'
import { RelayPool } from 'applesauce-relay'
import { NostrConnectSigner } from 'applesauce-signers'
import { reconnectBunkerSigner } from './services/nostrConnect'
import { createAddressLoader } from 'applesauce-loaders/loaders'
import Bookmarks from './components/Bookmarks'
import RouteDebug from './components/RouteDebug'
import Toast from './components/Toast'
import { useToast } from './hooks/useToast'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { RELAYS } from './config/relays'
import { SkeletonThemeProvider } from './components/Skeletons'

const DEFAULT_ARTICLE = import.meta.env.VITE_DEFAULT_ARTICLE_NADDR || 
  'naddr1qvzqqqr4gupzqmjxss3dld622uu8q25gywum9qtg4w4cv4064jmg20xsac2aam5nqqxnzd3cxqmrzv3exgmr2wfesgsmew'

// AppRoutes component that has access to hooks
function AppRoutes({ 
  relayPool, 
  showToast 
}: { 
  relayPool: RelayPool
  showToast: (message: string) => void
}) {
  const accountManager = Hooks.useAccountManager()

  const handleLogout = () => {
    accountManager.clearActive()
    showToast('Logged out successfully')
  }

  return (
    <Routes>
      <Route 
        path="/a/:naddr" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/r/*" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/settings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/support" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/explore" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/explore/writings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/me" 
        element={<Navigate to="/me/highlights" replace />} 
      />
      <Route 
        path="/me/highlights" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/me/reading-list" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/me/reads" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/me/reads/:filter" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/me/links" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/me/writings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/p/:npub" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route 
        path="/p/:npub/writings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
          />
        } 
      />
      <Route path="/" element={<Navigate to={`/a/${DEFAULT_ARTICLE}`} replace />} />
    </Routes>
  )
}

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [relayPool, setRelayPool] = useState<RelayPool | null>(null)
  const { toastMessage, toastType, showToast, clearToast } = useToast()
  const isOnline = useOnlineStatus()

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize event store, account manager, and relay pool
      const store = new EventStore()
      const accounts = new AccountManager()
      
      // Register common account types (needed for deserialization)
      registerCommonAccountTypes(accounts)
      
      // Create relay pool and set it up BEFORE loading accounts
      // NostrConnectAccount.fromJSON needs this to restore the signer
      const pool = new RelayPool()
      NostrConnectSigner.pool = pool
      pool.group(RELAYS)
      
      // Enable debug logging for NostrConnectSigner
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('debug', '*NostrConnectSigner*')
      }
      
      // Load persisted accounts from localStorage
      try {
        const accountsJson = localStorage.getItem('accounts')
        if (accountsJson) {
          await accounts.fromJSON(JSON.parse(accountsJson))
        }
        
        // Restore active account
        const activeId = localStorage.getItem('active')
        if (activeId && accounts.getAccount(activeId)) {
          accounts.setActive(activeId)
        }
      } catch (err) {
        console.error('[bunker] Failed to restore accounts:', err)
      }
      
      // Persist accounts to localStorage
      const accountsSub = accounts.accounts$.subscribe(() => {
        localStorage.setItem('accounts', JSON.stringify(accounts.toJSON()))
      })
      
      const activeSub = accounts.active$.subscribe((account) => {
        if (account) {
          localStorage.setItem('active', account.id)
        } else {
          localStorage.removeItem('active')
        }
      })
      
      // Reconnect bunker signers on page load
      const reconnectedAccounts = new Set<string>()
      const bunkerReconnectSub = accounts.active$.subscribe(async (account) => {
        if (account?.type === 'nostr-connect' && !reconnectedAccounts.has(account.id)) {
          reconnectedAccounts.add(account.id)
          
          try {
            await reconnectBunkerSigner(account as Accounts.NostrConnectAccount<unknown>, pool)
            console.log('[bunker] Reconnected to bunker signer')
          } catch (error) {
            console.error('[bunker] Failed to reconnect signer:', error)
          }
        }
      })
      
      // Keep all relay connections alive indefinitely by creating a persistent subscription
      // This prevents disconnection when no other subscriptions are active
      // Create a minimal subscription that never completes to keep connections alive
      const keepAliveSub = pool.subscription(RELAYS, { kinds: [0], limit: 0 }).subscribe({
        next: () => {}, // No-op, we don't care about events
        error: (err) => console.warn('Keep-alive subscription error:', err)
      })
      console.log('🔗 Created keep-alive subscription for', RELAYS.length, 'relay(s)')
      
      // Store subscription for cleanup
      ;(pool as unknown as { _keepAliveSubscription: typeof keepAliveSub })._keepAliveSubscription = keepAliveSub
      
      // Attach address/replaceable loaders so ProfileModel can fetch profiles
      const addressLoader = createAddressLoader(pool, {
        eventStore: store,
        lookupRelays: RELAYS
      })
      store.addressableLoader = addressLoader
      store.replaceableLoader = addressLoader

      setEventStore(store)
      setAccountManager(accounts)
      setRelayPool(pool)
      
      // Cleanup function
      return () => {
        accountsSub.unsubscribe()
        activeSub.unsubscribe()
        bunkerReconnectSub.unsubscribe()
        // Clean up keep-alive subscription if it exists
        const poolWithSub = pool as unknown as { _keepAliveSubscription?: { unsubscribe: () => void } }
        if (poolWithSub._keepAliveSubscription) {
          poolWithSub._keepAliveSubscription.unsubscribe()
        }
      }
    }
    
    let cleanup: (() => void) | undefined
    initializeApp().then((fn) => {
      cleanup = fn
    })
    
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  // Monitor online/offline status
  useEffect(() => {
    if (!isOnline) {
      showToast('You are offline. Some features may be limited.')
    }
  }, [isOnline, showToast])

  // Listen for service worker updates
  useEffect(() => {
    const handleSWUpdate = () => {
      showToast('New version available! Refresh to update.')
    }

    window.addEventListener('sw-update-available', handleSWUpdate)
    return () => {
      window.removeEventListener('sw-update-available', handleSWUpdate)
    }
  }, [showToast])

  if (!eventStore || !accountManager || !relayPool) {
    return (
      <div className="loading">
        <FontAwesomeIcon icon={faSpinner} spin />
      </div>
    )
  }

  return (
    <SkeletonThemeProvider>
      <EventStoreProvider eventStore={eventStore}>
        <AccountsProvider manager={accountManager}>
          <BrowserRouter>
            <div className="min-h-screen p-0 max-w-none m-0 relative">
              <AppRoutes relayPool={relayPool} showToast={showToast} />
              <RouteDebug />
            </div>
          </BrowserRouter>
          {toastMessage && (
            <Toast
              message={toastMessage}
              type={toastType}
              onClose={clearToast}
            />
          )}
        </AccountsProvider>
      </EventStoreProvider>
    </SkeletonThemeProvider>
  )
}

export default App
