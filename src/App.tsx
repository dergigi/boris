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
import { getDefaultBunkerPermissions } from './services/nostrConnect'
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
      console.log('[bunker] ✅ Pool assigned to NostrConnectSigner (before account load)')
      
      // Create a relay group for better event deduplication and management
      pool.group(RELAYS)
      console.log('[bunker] Created relay group with', RELAYS.length, 'relays (including local)')
      
      // Load persisted accounts from localStorage
      try {
        const accountsJson = localStorage.getItem('accounts')
        console.log('[bunker] Raw accounts from localStorage:', accountsJson)
        
        const json = JSON.parse(accountsJson || '[]')
        console.log('[bunker] Parsed accounts:', json.length, 'accounts')
        
        await accounts.fromJSON(json)
        console.log('[bunker] Loaded', accounts.accounts.length, 'accounts from storage')
        console.log('[bunker] Account types:', accounts.accounts.map(a => ({ id: a.id, type: a.type })))
        
        // Load active account from storage
        const activeId = localStorage.getItem('active')
        console.log('[bunker] Active ID from localStorage:', activeId)
        
        if (activeId) {
          const account = accounts.getAccount(activeId)
          console.log('[bunker] Found account for ID?', !!account, account?.type)
          
          if (account) {
            accounts.setActive(activeId)
            console.log('[bunker] ✅ Restored active account:', activeId, 'type:', account.type)
          } else {
            console.warn('[bunker] ⚠️  Active ID found but account not in list')
          }
        } else {
          console.log('[bunker] No active account ID in localStorage')
        }
      } catch (err) {
        console.error('[bunker] ❌ Failed to load accounts from storage:', err)
      }
      
      // Subscribe to accounts changes and persist to localStorage
      const accountsSub = accounts.accounts$.subscribe(() => {
        localStorage.setItem('accounts', JSON.stringify(accounts.toJSON()))
      })
      
      // Subscribe to active account changes and persist to localStorage
      const activeSub = accounts.active$.subscribe((account) => {
        if (account) {
          localStorage.setItem('active', account.id)
        } else {
          localStorage.removeItem('active')
        }
      })
      
      // Reconnect bunker signers when active account changes
      // Keep track of which accounts we've already reconnected to avoid double-connecting
      const reconnectedAccounts = new Set<string>()
      
            const bunkerReconnectSub = accounts.active$.subscribe(async (account) => {
              console.log('[bunker] Active account changed:', { 
                hasAccount: !!account, 
                type: account?.type,
                id: account?.id 
              })
              
              if (account && account.type === 'nostr-connect') {
                const nostrConnectAccount = account as Accounts.NostrConnectAccount<unknown>
                // Sanity check: remote (bunker) pubkey must not equal our pubkey
                if (nostrConnectAccount.signer.remote === nostrConnectAccount.pubkey) {
                  console.warn('[bunker] ❌ Invalid bunker state: remote pubkey equals user pubkey. Please reconnect using a fresh bunker URI from Amber.')
                  try { showToast?.('Reconnect bunker from Amber: invalid remote pubkey detected') } catch {}
                }
                
                // Skip if we've already reconnected this account
                if (reconnectedAccounts.has(account.id)) {
                  console.log('[bunker] ⏭️  Already reconnected this account, skipping')
                  return
                }
                
                console.log('[bunker] Account detected. Status:', {
                  listening: nostrConnectAccount.signer.listening,
                  isConnected: nostrConnectAccount.signer.isConnected,
                  hasRemote: !!nostrConnectAccount.signer.remote,
                  bunkerRelays: nostrConnectAccount.signer.relays
                })
                
                try {
                  // For restored signers, ensure they have the pool's subscription methods
                  // The signer was created in fromJSON without pool context, so we need to recreate it
                  const signerData = nostrConnectAccount.toJSON().signer
                  
                  // Add bunker's relays to the pool BEFORE recreating the signer
                  // This ensures the pool has all relays when the signer sets up its methods
                  const bunkerRelays = signerData.relays || []
                  const existingRelayUrls = new Set(Array.from(pool.relays.keys()))
                  const newBunkerRelays = bunkerRelays.filter(url => !existingRelayUrls.has(url))
                  
                  if (newBunkerRelays.length > 0) {
                    console.log('[bunker] Adding bunker relays to pool BEFORE signer recreation:', newBunkerRelays)
                    pool.group(newBunkerRelays)
                  } else {
                    console.log('[bunker] Bunker relays already in pool')
                  }
                  
                  const recreatedSigner = new NostrConnectSigner({
                    relays: signerData.relays,
                    pubkey: nostrConnectAccount.pubkey,
                    remote: signerData.remote,
                    signer: nostrConnectAccount.signer.signer, // Use the existing SimpleSigner
                    pool: pool
                  })
                  
                  // Replace the signer on the account
                  nostrConnectAccount.signer = recreatedSigner
                  console.log('[bunker] ✅ Signer recreated with pool context')

                  // Debug: log publish/subscription calls made by signer (decrypt/sign requests)
                  const originalPublish = (recreatedSigner as any).publishMethod
                  ;(recreatedSigner as any).publishMethod = (relays: string[], event: any) => {
                    try {
                      const pTag = Array.isArray(event?.tags) ? event.tags.find((t: any) => t?.[0] === 'p')?.[1] : undefined
                      console.log('[bunker] publish via signer:', { relays, kind: event?.kind, tags: event?.tags, pTag, remote: nostrConnectAccount.signer.remote, userPubkey: nostrConnectAccount.pubkey })
                    } catch {}
                    return originalPublish(relays, event)
                  }
                  const originalSubscribe = (recreatedSigner as any).subscriptionMethod
                  ;(recreatedSigner as any).subscriptionMethod = (relays: string[], filters: any[]) => {
                    try { console.log('[bunker] subscribe via signer:', { relays, filters }) } catch {}
                    return originalSubscribe(relays, filters)
                  }

                  
                  // Just ensure the signer is listening for responses - don't call connect() again
                  // The fromBunkerURI already connected with permissions during login
                  if (!nostrConnectAccount.signer.listening) {
                    console.log('[bunker] Opening signer subscription...')
                    await nostrConnectAccount.signer.open()
                    console.log('[bunker] ✅ Signer subscription opened')
                  } else {
                    console.log('[bunker] ✅ Signer already listening')
                  }
                  
                  // Attempt a guarded reconnect to ensure Amber authorizes decrypt operations
                  try {
                    if (nostrConnectAccount.signer.remote && !reconnectedAccounts.has(account.id)) {
                      const permissions = getDefaultBunkerPermissions()
                      console.log('[bunker] Attempting guarded connect() with permissions to ensure decrypt perms', { count: permissions.length })
                      await nostrConnectAccount.signer.connect(undefined, permissions)
                      console.log('[bunker] ✅ Guarded connect() succeeded with permissions')
                    }
                  } catch (e) {
                    console.warn('[bunker] ⚠️ Guarded connect() failed:', e)
                  }
                  
                  // Give the subscription a moment to fully establish before allowing decrypt operations
                  // This ensures the signer is ready to handle and receive responses
                  await new Promise(resolve => setTimeout(resolve, 100))
                  console.log("[bunker] Subscription ready after startup delay")
                  // Fire-and-forget: probe decrypt path to verify Amber responds to NIP-46 decrypt
                  try {
                    const withTimeout = async <T,>(p: Promise<T>, ms = 3000): Promise<T> => {
                      return await Promise.race([
                        p,
                        new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`probe timeout after ${ms}ms`)), ms)),
                      ])
                    }
                    setTimeout(async () => {
                      try {
                        console.log('[bunker] 🔎 Probe nip44.decrypt…')
                        await withTimeout(nostrConnectAccount.signer.nip44!.decrypt(nostrConnectAccount.pubkey, 'invalid-ciphertext'))
                        console.log('[bunker] 🔎 Probe nip44.decrypt responded')
                      } catch (err) {
                        console.log('[bunker] 🔎 Probe nip44 result:', err instanceof Error ? err.message : err)
                      }
                      try {
                        console.log('[bunker] 🔎 Probe nip04.decrypt…')
                        await withTimeout(nostrConnectAccount.signer.nip04!.decrypt(nostrConnectAccount.pubkey, 'invalid-ciphertext'))
                        console.log('[bunker] 🔎 Probe nip04.decrypt responded')
                      } catch (err) {
                        console.log('[bunker] 🔎 Probe nip04 result:', err instanceof Error ? err.message : err)
                      }
                    }, 0)
                  } catch (err) {
                    console.log('[bunker] 🔎 Probe setup failed:', err)
                  }
                  // The bunker remembers the permissions from the initial connection
                  nostrConnectAccount.signer.isConnected = true
                  
                  console.log('[bunker] Final signer status:', {
                    listening: nostrConnectAccount.signer.listening,
                    isConnected: nostrConnectAccount.signer.isConnected,
                    remote: nostrConnectAccount.signer.remote,
                    relays: nostrConnectAccount.signer.relays
                  })
                  
                  // Mark this account as reconnected
                  reconnectedAccounts.add(account.id)
                  console.log('[bunker] 🎉 Signer ready for signing')
                } catch (error) {
                  console.error('[bunker] ❌ Failed to open signer:', error)
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
