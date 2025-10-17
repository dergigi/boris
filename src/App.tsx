import { useState, useEffect, useCallback, useRef } from 'react'
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
import Debug from './components/Debug'
import Bookmarks from './components/Bookmarks'
import RouteDebug from './components/RouteDebug'
import Toast from './components/Toast'
import { useToast } from './hooks/useToast'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { RELAYS } from './config/relays'
import { SkeletonThemeProvider } from './components/Skeletons'
import { DebugBus } from './utils/debugBus'
import { Bookmark } from './types/bookmarks'
import { fetchBookmarks } from './services/bookmarkService'

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
  const activeAccount = Hooks.useActiveAccount()
  
  // Centralized bookmark state
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const isLoadingRef = useRef(false)

  // Load bookmarks function
  const loadBookmarks = useCallback(async () => {
    if (!relayPool || !activeAccount || isLoadingRef.current) return
    
    try {
      isLoadingRef.current = true
      setBookmarksLoading(true)
      console.log('[app] 🔍 Loading bookmarks for', activeAccount.pubkey.slice(0, 8))
      
      const fullAccount = accountManager.getActive()
      await fetchBookmarks(relayPool, fullAccount || activeAccount, setBookmarks)
      
      console.log('[app] ✅ Bookmarks loaded')
    } catch (error) {
      console.error('[app] ❌ Failed to load bookmarks:', error)
    } finally {
      setBookmarksLoading(false)
      isLoadingRef.current = false
    }
  }, [relayPool, activeAccount, accountManager])

  // Refresh bookmarks (for manual refresh button)
  const handleRefreshBookmarks = useCallback(async () => {
    console.log('[app] 🔄 Manual refresh triggered')
    await loadBookmarks()
  }, [loadBookmarks])

  // Load bookmarks on mount if account exists (app reopen)
  useEffect(() => {
    if (activeAccount && relayPool) {
      console.log('[app] 📱 App mounted with active account, loading bookmarks')
      loadBookmarks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only on mount, loadBookmarks is stable

  // Load bookmarks when account changes (login)
  useEffect(() => {
    if (activeAccount && relayPool) {
      console.log('[app] 👤 Active account changed, loading bookmarks')
      loadBookmarks()
    }
  }, [activeAccount, relayPool, loadBookmarks])

  const handleLogout = () => {
    accountManager.clearActive()
    setBookmarks([]) // Clear bookmarks on logout
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
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/r/*" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/settings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/support" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/explore" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/explore/writings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
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
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/me/reading-list" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/me/reads" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/me/reads/:filter" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/me/links" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/me/writings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/p/:npub" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route 
        path="/p/:npub/writings" 
        element={
          <Bookmarks 
            relayPool={relayPool}
            onLogout={handleLogout}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
          />
        } 
      />
      <Route path="/debug" element={<Debug relayPool={relayPool} />} />
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
      
      // Disable request queueing globally - makes all operations instant
      // Queue causes requests to wait for user interaction which blocks batch operations
      accounts.disableQueue = true
      
      // Register common account types (needed for deserialization)
      registerCommonAccountTypes(accounts)
      
      // Create relay pool and set it up BEFORE loading accounts
      // NostrConnectAccount.fromJSON needs this to restore the signer
      const pool = new RelayPool()
      // Wire the signer to use this pool; make publish non-blocking so callers don't
      // wait for every relay send to finish. Responses still resolve the pending request.
      NostrConnectSigner.subscriptionMethod = pool.subscription.bind(pool)
      NostrConnectSigner.publishMethod = (relays: string[], event: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = pool.publish(relays, event as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (result && typeof (result as any).subscribe === 'function') {
          // Subscribe to the observable but ignore completion/errors (fire-and-forget)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          try { (result as any).subscribe({ complete: () => { /* noop */ }, error: () => { /* noop */ } }) } catch { /* ignore */ }
        }
        // Return an already-resolved promise so upstream await finishes immediately
        return Promise.resolve()
      }
      console.log('[bunker] ✅ Wired NostrConnectSigner to RelayPool publish/subscription (before account load)')
      
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
                // Disable applesauce account queueing so decrypt requests aren't serialized behind earlier ops
                try {
                  if (!(nostrConnectAccount as unknown as { disableQueue?: boolean }).disableQueue) {
                    (nostrConnectAccount as unknown as { disableQueue?: boolean }).disableQueue = true
                    console.log('[bunker] ⚙️  Disabled account request queueing for nostr-connect')
                  }
                } catch (err) { console.warn('[bunker] failed to disable queue', err) }
                // Note: for Amber bunker, the remote signer pubkey is the user's pubkey. This is expected.
                
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
                  // Ensure local relays are included for NIP-46 request/response traffic (e.g., Amber bunker)
                  try {
                    const mergedRelays = Array.from(new Set([...(signerData.relays || []), ...RELAYS]))
                    recreatedSigner.relays = mergedRelays
                    console.log('[bunker] 🔗 Signer relays merged with app RELAYS:', mergedRelays)
                  } catch (err) { console.warn('[bunker] failed to merge signer relays', err) }
                  
                  // Replace the signer on the account
                  nostrConnectAccount.signer = recreatedSigner
                  console.log('[bunker] ✅ Signer recreated with pool context')

                  // Debug: log publish/subscription calls made by signer (decrypt/sign requests)
                  // IMPORTANT: bind originals to preserve `this` context used internally by the signer
                  const originalPublish = (recreatedSigner as unknown as { publishMethod: (relays: string[], event: unknown) => unknown }).publishMethod.bind(recreatedSigner)
                  ;(recreatedSigner as unknown as { publishMethod: (relays: string[], event: unknown) => unknown }).publishMethod = (relays: string[], event: unknown) => {
                    try {
                      let method: string | undefined
                      const content = (event as { content?: unknown })?.content
                      if (typeof content === 'string') {
                        try {
                          const parsed = JSON.parse(content) as { method?: string; id?: unknown }
                          method = parsed?.method
                        } catch (err) { console.warn('[bunker] failed to parse event content', err) }
                      }
                      const summary = {
                        relays,
                        kind: (event as { kind?: number })?.kind,
                        method,
                        // include tags array for debugging (NIP-46 expects method tag)
                        tags: (event as { tags?: unknown })?.tags,
                        contentLength: typeof content === 'string' ? content.length : undefined
                      }
                      console.log('[bunker] publish via signer:', summary)
                      try { DebugBus.info('bunker', 'publish', summary) } catch (err) { console.warn('[bunker] failed to log to DebugBus', err) }
                    } catch (err) { console.warn('[bunker] failed to log publish summary', err) }
                    // Fire-and-forget publish: trigger the publish but do not return the
                    // Observable/Promise to upstream to avoid their awaiting of completion.
                    const result = originalPublish(relays, event)
                    if (result && typeof (result as { subscribe?: unknown }).subscribe === 'function') {
                      // Subscribe to the observable but ignore completion/errors (fire-and-forget)
                      try { (result as { subscribe: (h: { complete?: () => void; error?: (e: unknown) => void }) => unknown }).subscribe({ complete: () => { /* noop */ }, error: () => { /* noop */ } }) } catch { /* ignore */ }
                    }
                    // If it's a Promise, simply ignore it (no await) so it resolves in the background.
                    // Return a benign object so callers that probe for a "subscribe" property
                    // (e.g., applesauce makeRequest) won't throw on `"subscribe" in result`.
                    return {} as unknown as never
                  }
                  const originalSubscribe = (recreatedSigner as unknown as { subscriptionMethod: (relays: string[], filters: unknown[]) => unknown }).subscriptionMethod.bind(recreatedSigner)
                  ;(recreatedSigner as unknown as { subscriptionMethod: (relays: string[], filters: unknown[]) => unknown }).subscriptionMethod = (relays: string[], filters: unknown[]) => {
                    try {
                      console.log('[bunker] subscribe via signer:', { relays, filters })
                      try { DebugBus.info('bunker', 'subscribe', { relays, filters }) } catch (err) { console.warn('[bunker] failed to log subscribe to DebugBus', err) }
                    } catch (err) { console.warn('[bunker] failed to log subscribe summary', err) }
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
                    const withTimeout = async <T,>(p: Promise<T>, ms = 10000): Promise<T> => {
                      return await Promise.race([
                        p,
                        new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`probe timeout after ${ms}ms`)), ms)),
                      ])
                    }
                    setTimeout(async () => {
                      const self = nostrConnectAccount.pubkey
                      // Try a roundtrip so the bunker can respond successfully
                      try {
                        console.log('[bunker] 🔎 Probe nip44 roundtrip (encrypt→decrypt)…')
                        const cipher44 = await withTimeout(nostrConnectAccount.signer.nip44!.encrypt(self, 'probe-nip44'))
                        const plain44 = await withTimeout(nostrConnectAccount.signer.nip44!.decrypt(self, cipher44))
                        console.log('[bunker] 🔎 Probe nip44 responded:', typeof plain44 === 'string' ? plain44 : typeof plain44)
                      } catch (err) {
                        console.log('[bunker] 🔎 Probe nip44 result:', err instanceof Error ? err.message : err)
                      }
                      try {
                        console.log('[bunker] 🔎 Probe nip04 roundtrip (encrypt→decrypt)…')
                        const cipher04 = await withTimeout(nostrConnectAccount.signer.nip04!.encrypt(self, 'probe-nip04'))
                        const plain04 = await withTimeout(nostrConnectAccount.signer.nip04!.decrypt(self, cipher04))
                        console.log('[bunker] 🔎 Probe nip04 responded:', typeof plain04 === 'string' ? plain04 : typeof plain04)
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
  }, [isOnline, showToast])

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
