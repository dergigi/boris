import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { EventStoreProvider, AccountsProvider, Hooks } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager, Accounts } from 'applesauce-accounts'
import { registerCommonAccountTypes } from 'applesauce-accounts/accounts'
import { RelayPool } from 'applesauce-relay'
import { NostrConnectSigner } from 'applesauce-signers'
import type { NostrEvent } from 'nostr-tools'
import { getDefaultBunkerPermissions } from './services/nostrConnect'
import { createAddressLoader } from 'applesauce-loaders/loaders'
import Debug from './components/Debug'
import Bookmarks from './components/Bookmarks'
import RouteDebug from './components/RouteDebug'
import Toast from './components/Toast'
import ShareTargetHandler from './components/ShareTargetHandler'
import { useToast } from './hooks/useToast'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { RELAYS } from './config/relays'
import { SkeletonThemeProvider } from './components/Skeletons'
import { loadUserRelayList, loadBlockedRelays, computeRelaySet } from './services/relayListService'
import { applyRelaySetToPool, getActiveRelayUrls, ALWAYS_LOCAL_RELAYS, HARDCODED_RELAYS } from './services/relayManager'
import { Bookmark } from './types/bookmarks'
import { bookmarkController } from './services/bookmarkController'
import { contactsController } from './services/contactsController'
import { highlightsController } from './services/highlightsController'
import { writingsController } from './services/writingsController'
import { readingProgressController } from './services/readingProgressController'
// import { fetchNostrverseHighlights } from './services/nostrverseService'
import { nostrverseHighlightsController } from './services/nostrverseHighlightsController'
import { nostrverseWritingsController } from './services/nostrverseWritingsController'
import { archiveController } from './services/archiveController'

const DEFAULT_ARTICLE = import.meta.env.VITE_DEFAULT_ARTICLE_NADDR || 
  'naddr1qvzqqqr4gupzqmjxss3dld622uu8q25gywum9qtg4w4cv4064jmg20xsac2aam5nqqxnzd3cxqmrzv3exgmr2wfesgsmew'

// AppRoutes component that has access to hooks
function AppRoutes({ 
  relayPool, 
  eventStore,
  showToast 
}: { 
  relayPool: RelayPool
  eventStore: EventStore | null
  showToast: (message: string) => void
}) {
  const accountManager = Hooks.useAccountManager()
  const activeAccount = Hooks.useActiveAccount()
  
  // Centralized bookmark state (fed by controller)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(false)

  // Centralized contacts state (fed by controller)
  const [contacts, setContacts] = useState<Set<string>>(new Set())
  const [contactsLoading, setContactsLoading] = useState(false)

  // Subscribe to bookmark controller
  useEffect(() => {
    const unsubBookmarks = bookmarkController.onBookmarks((bookmarks) => {
      setBookmarks(bookmarks)
    })
    const unsubLoading = bookmarkController.onLoading((loading) => {
      setBookmarksLoading(loading)
    })
    
    return () => {
      unsubBookmarks()
      unsubLoading()
    }
  }, [])

  // Subscribe to contacts controller
  useEffect(() => {
    const unsubContacts = contactsController.onContacts((contacts) => {
      setContacts(contacts)
    })
    const unsubLoading = contactsController.onLoading((loading) => {
      setContactsLoading(loading)
    })
    
    return () => {
      unsubContacts()
      unsubLoading()
    }
  }, [])


  // Auto-load bookmarks, contacts, and highlights when account is ready (on login or page mount)
  useEffect(() => {
    if (activeAccount && relayPool) {
      const pubkey = (activeAccount as { pubkey?: string }).pubkey
      
      // Load bookmarks
      if (bookmarks.length === 0 && !bookmarksLoading) {
        bookmarkController.start({ relayPool, activeAccount, accountManager, eventStore: eventStore || undefined })
      }
      
      // Load contacts
      if (pubkey && contacts.size === 0 && !contactsLoading) {
        contactsController.start({ relayPool, pubkey })
      }
      
      // Load highlights (controller manages its own state)
      if (pubkey && eventStore && !highlightsController.isLoadedFor(pubkey)) {
        highlightsController.start({ relayPool, eventStore, pubkey })
      }

      // Load writings (controller manages its own state)
      if (pubkey && eventStore && !writingsController.isLoadedFor(pubkey)) {
        writingsController.start({ relayPool, eventStore, pubkey })
      }

      // Load reading progress (controller manages its own state)
      if (pubkey && eventStore && !readingProgressController.isLoadedFor(pubkey)) {
        readingProgressController.start({ relayPool, eventStore, pubkey })
      }

      // Load archive (marked-as-read) controller
      if (pubkey && eventStore && !archiveController.isLoadedFor(pubkey)) {
        archiveController.start({ relayPool, eventStore, pubkey })
      }

      // Start centralized nostrverse highlights controller (non-blocking)
      if (eventStore) {
        nostrverseHighlightsController.start({ relayPool, eventStore })
        nostrverseWritingsController.start({ relayPool, eventStore })
      }
    }
  }, [activeAccount, relayPool, eventStore, bookmarks.length, bookmarksLoading, contacts.size, contactsLoading, accountManager])

  // Ensure nostrverse controllers run even when logged out
  useEffect(() => {
    if (relayPool && eventStore) {
      nostrverseHighlightsController.start({ relayPool, eventStore })
      nostrverseWritingsController.start({ relayPool, eventStore })
    }
  }, [relayPool, eventStore])

  // Manual refresh (for sidebar button)
  const handleRefreshBookmarks = useCallback(async () => {
    if (!relayPool || !activeAccount) {
      return
    }
    bookmarkController.reset()
    await bookmarkController.start({ relayPool, activeAccount, accountManager })
  }, [relayPool, activeAccount, accountManager])

  const handleLogout = () => {
    accountManager.clearActive()
    bookmarkController.reset() // Clear bookmarks via controller
    contactsController.reset() // Clear contacts via controller
    highlightsController.reset() // Clear highlights via controller
    readingProgressController.reset() // Clear reading progress via controller
    archiveController.reset() // Clear archive state
    showToast('Logged out successfully')
  }

  return (
    <Routes>
      <Route 
        path="/share-target" 
        element={<ShareTargetHandler relayPool={relayPool} />} 
      />
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
        path="/my" 
        element={<Navigate to="/my/highlights" replace />} 
      />
      <Route 
        path="/my/highlights" 
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
        path="/my/bookmarks" 
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
        path="/my/reads" 
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
        path="/my/reads/:filter" 
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
        path="/my/links" 
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
        path="/my/links/:filter" 
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
        path="/my/writings" 
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
      <Route 
        path="/e/:eventId" 
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
        path="/debug" 
        element={
          <Debug 
            relayPool={relayPool}
            eventStore={eventStore}
            bookmarks={bookmarks}
            bookmarksLoading={bookmarksLoading}
            onRefreshBookmarks={handleRefreshBookmarks}
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
      NostrConnectSigner.publishMethod = (relays: string[], event: NostrEvent) => {
        // Fire-and-forget publish; do not block callers
        pool.publish(relays, event).catch(() => { /* ignore errors */ })
        return Promise.resolve()
      }
      
      // Create a relay group for better event deduplication and management
      pool.group(RELAYS)
      
      // Load persisted accounts from localStorage
      try {
        const accountsJson = localStorage.getItem('accounts')
        
        const json = JSON.parse(accountsJson || '[]')
        
        await accounts.fromJSON(json)
        
        // Load active account from storage
        const activeId = localStorage.getItem('active')
        
        if (activeId) {
          const account = accounts.getAccount(activeId)
          
          if (account) {
            accounts.setActive(activeId)
          }
        }
      } catch (err) {
        console.error('Failed to load accounts from storage:', err)
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
              
              if (account && account.type === 'nostr-connect') {
                const nostrConnectAccount = account as Accounts.NostrConnectAccount<unknown>
                // Disable applesauce account queueing so decrypt requests aren't serialized behind earlier ops
                try {
                  if (!(nostrConnectAccount as unknown as { disableQueue?: boolean }).disableQueue) {
                    (nostrConnectAccount as unknown as { disableQueue?: boolean }).disableQueue = true
                  }
                } catch (err) {
                  // Ignore queue disable errors
                }
                // Note: for Amber bunker, the remote signer pubkey is the user's pubkey. This is expected.
                
                // Skip if we've already reconnected this account
                if (reconnectedAccounts.has(account.id)) {
                  return
                }
                
                
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
                    pool.group(newBunkerRelays)
                  } else {
                    // Bunker relays already in pool
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
                  } catch (err) { /* ignore */ }
                  
                  // Replace the signer on the account
                  nostrConnectAccount.signer = recreatedSigner
                  
                  // Fire-and-forget publish for bunker: trigger but don't wait for completion
                  // IMPORTANT: bind originals to preserve `this` context used internally by the signer
                  const originalPublish = (recreatedSigner as unknown as { publishMethod: (relays: string[], event: unknown) => unknown }).publishMethod.bind(recreatedSigner)
                  ;(recreatedSigner as unknown as { publishMethod: (relays: string[], event: unknown) => unknown }).publishMethod = (relays: string[], event: unknown) => {
                    const result = originalPublish(relays, event)
                    if (result && typeof (result as { subscribe?: unknown }).subscribe === 'function') {
                      try { (result as { subscribe: (h: { complete?: () => void; error?: (e: unknown) => void }) => unknown }).subscribe({ complete: () => { /* noop */ }, error: () => { /* noop */ } }) } catch { /* ignore */ }
                    }
                    return {} as unknown as never
                  }

                  
                  // Just ensure the signer is listening for responses - don't call connect() again
                  // The fromBunkerURI already connected with permissions during login
                  if (!nostrConnectAccount.signer.listening) {
                    await nostrConnectAccount.signer.open()
                  }
                  
                  // Attempt a guarded reconnect to ensure Amber authorizes decrypt operations
                  try {
                    if (nostrConnectAccount.signer.remote && !reconnectedAccounts.has(account.id)) {
                      const permissions = getDefaultBunkerPermissions()
                      await nostrConnectAccount.signer.connect(undefined, permissions)
                    }
                  } catch (e) {
                    // Ignore reconnect errors
                  }
                  
                  // Give the subscription a moment to fully establish before allowing decrypt operations
                  // This ensures the signer is ready to handle and receive responses
                  await new Promise(resolve => setTimeout(resolve, 100))
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
                        await withTimeout(nostrConnectAccount.signer.nip44!.encrypt(self, 'probe-nip44'))
                        await withTimeout(nostrConnectAccount.signer.nip44!.decrypt(self, ''))
                      } catch (_err) {
                        // Ignore probe errors
                      }
                      try {
                        await withTimeout(nostrConnectAccount.signer.nip04!.encrypt(self, 'probe-nip04'))
                        await withTimeout(nostrConnectAccount.signer.nip04!.decrypt(self, ''))
                      } catch (_err) {
                        // Ignore probe errors
                      }
                    }, 0)
                  } catch (_err) {
                    // Ignore signer setup errors
                  }
                  // The bunker remembers the permissions from the initial connection
                  nostrConnectAccount.signer.isConnected = true
                  
                  
                  // Mark this account as reconnected
                  reconnectedAccounts.add(account.id)
                } catch (error) {
                  console.error('Failed to open signer:', error)
                }
              }
            })
      
      // Handle user relay list and blocked relays when account changes
      const userRelaysSub = accounts.active$.subscribe((account) => {
        if (account) {
          // User logged in - start with hardcoded relays immediately, then stream user relay list updates
          const pubkey = account.pubkey

          // Bunker relays (if any)
          let bunkerRelays: string[] = []
          if (account.type === 'nostr-connect') {
            const nostrConnectAccount = account as Accounts.NostrConnectAccount<unknown>
            const signerData = nostrConnectAccount.toJSON().signer
            bunkerRelays = signerData.relays || []
          }
          

          // Start with hardcoded + bunker relays immediately (non-blocking)
          const initialRelays = computeRelaySet({
            hardcoded: RELAYS,
            bunker: bunkerRelays,
            userList: [],
            blocked: [],
            alwaysIncludeLocal: ALWAYS_LOCAL_RELAYS
          })
          

          // Apply initial set immediately
          applyRelaySetToPool(pool, initialRelays)

          // Prepare keep-alive helper
          const updateKeepAlive = () => {
            const poolWithSub = pool as unknown as { _keepAliveSubscription?: { unsubscribe: () => void } }
            if (poolWithSub._keepAliveSubscription) {
              poolWithSub._keepAliveSubscription.unsubscribe()
            }
            const activeRelays = getActiveRelayUrls(pool)
            const newKeepAliveSub = pool.subscription(activeRelays, { kinds: [0], limit: 0 }).subscribe({
              next: () => {},
              error: () => {}
            })
            poolWithSub._keepAliveSubscription = newKeepAliveSub
          }

          // Begin loading blocked relays in background
          const blockedPromise = loadBlockedRelays(pool, pubkey)

          // Stream user relay list; apply immediately on first/updated event
          loadUserRelayList(pool, pubkey, {
            onUpdate: (userRelays) => {
              const interimRelays = computeRelaySet({
                hardcoded: HARDCODED_RELAYS,
                bunker: bunkerRelays,
                userList: userRelays,
                blocked: [],
                alwaysIncludeLocal: ALWAYS_LOCAL_RELAYS
              })
              
              applyRelaySetToPool(pool, interimRelays)
              updateKeepAlive()
            }
          }).then(async (userRelayList) => {
            const blockedRelays = await blockedPromise.catch(() => [])

            const finalRelays = computeRelaySet({
              hardcoded: userRelayList.length > 0 ? HARDCODED_RELAYS : RELAYS,
              bunker: bunkerRelays,
              userList: userRelayList,
              blocked: blockedRelays,
              alwaysIncludeLocal: ALWAYS_LOCAL_RELAYS
            })
            
            applyRelaySetToPool(pool, finalRelays)
            
            updateKeepAlive()
            
            // Update address loader with new relays
            const activeRelays = getActiveRelayUrls(pool)
            const addressLoader = createAddressLoader(pool, {
              eventStore: store,
              lookupRelays: activeRelays
            })
            store.addressableLoader = addressLoader
            store.replaceableLoader = addressLoader
          }).catch((error) => {
            console.error('[relay-init] Failed to load user relay list (continuing with initial set):', error)
            // Continue with initial relay set on error - no need to change anything
          })
        } else {
          // User logged out - reset to hardcoded relays
          
          applyRelaySetToPool(pool, RELAYS)
          
          
          // Update keep-alive subscription
          const poolWithSub = pool as unknown as { _keepAliveSubscription?: { unsubscribe: () => void } }
          if (poolWithSub._keepAliveSubscription) {
            poolWithSub._keepAliveSubscription.unsubscribe()
          }
          const newKeepAliveSub = pool.subscription(RELAYS, { kinds: [0], limit: 0 }).subscribe({
            next: () => {},
            error: () => {}
          })
          poolWithSub._keepAliveSubscription = newKeepAliveSub
          
          // Reset address loader
          const addressLoader = createAddressLoader(pool, {
            eventStore: store,
            lookupRelays: RELAYS
          })
          store.addressableLoader = addressLoader
          store.replaceableLoader = addressLoader
        }
      })
      
      // Keep all relay connections alive indefinitely by creating a persistent subscription
      // This prevents disconnection when no other subscriptions are active
      // Create a minimal subscription that never completes to keep connections alive
      const keepAliveSub = pool.subscription(RELAYS, { kinds: [0], limit: 0 }).subscribe({
        next: () => {},
        error: () => {}
      })
      
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
        userRelaysSub.unsubscribe()
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
              <AppRoutes relayPool={relayPool} eventStore={eventStore} showToast={showToast} />
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
