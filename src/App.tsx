import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { EventStoreProvider, AccountsProvider } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager } from 'applesauce-accounts'
import { registerCommonAccountTypes } from 'applesauce-accounts/accounts'
import { RelayPool } from 'applesauce-relay'
import { createAddressLoader } from 'applesauce-loaders/loaders'
import Login from './components/Login'
import Bookmarks from './components/Bookmarks'
import Toast from './components/Toast'
import { useToast } from './hooks/useToast'

const DEFAULT_ARTICLE = import.meta.env.VITE_DEFAULT_ARTICLE_NADDR || 
  'naddr1qvzqqqr4gupzqmjxss3dld622uu8q25gywum9qtg4w4cv4064jmg20xsac2aam5nqqxnzd3cxqmrzv3exgmr2wfesgsmew'

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [relayPool, setRelayPool] = useState<RelayPool | null>(null)
  const { toastMessage, toastType, showToast, clearToast } = useToast()

  useEffect(() => {
    // Initialize event store, account manager, and relay pool
    const store = new EventStore()
    const accounts = new AccountManager()
    
    // Register common account types (needed for deserialization)
    registerCommonAccountTypes(accounts)
    
    // Load persisted accounts from localStorage
    const loadAccounts = async () => {
      try {
        const json = JSON.parse(localStorage.getItem('accounts') || '[]')
        await accounts.fromJSON(json)
        console.log('Loaded', accounts.accounts.length, 'accounts from storage')
        
        // Load active account from storage
        const activeId = localStorage.getItem('active')
        if (activeId && accounts.getAccount(activeId)) {
          accounts.setActive(activeId)
          console.log('Restored active account:', activeId)
        }
      } catch (err) {
        console.error('Failed to load accounts from storage:', err)
      }
    }
    
    loadAccounts()
    
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
    
    const pool = new RelayPool()
    
    // Define relay URLs for bookmark fetching
    const relayUrls = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.dergigi.com',
      'wss://wot.dergigi.com',
      'wss://relay.snort.social',
      'wss://relay.current.fyi',
      'wss://nostr-pub.wellorder.net'
    ]
    
    // Create a relay group for better event deduplication and management
    // This follows the applesauce-relay documentation pattern
    // Note: We could use pool.group(relayUrls) for direct requests in the future
    pool.group(relayUrls)
    console.log('Created relay group with', relayUrls.length, 'relays')
    console.log('Relay URLs:', relayUrls)
    
    // Attach address/replaceable loaders so ProfileModel can fetch profiles
    const addressLoader = createAddressLoader(pool, {
      eventStore: store,
      lookupRelays: [
        'wss://purplepag.es',
        'wss://relay.primal.net',
        'wss://relay.nostr.band'
      ]
    })
    store.addressableLoader = addressLoader
    store.replaceableLoader = addressLoader

    setEventStore(store)
    setAccountManager(accounts)
    setRelayPool(pool)
    
    // Cleanup subscriptions on unmount
    return () => {
      accountsSub.unsubscribe()
      activeSub.unsubscribe()
    }
  }, [])

  if (!eventStore || !accountManager || !relayPool) {
    return (
      <div className="loading">
        <FontAwesomeIcon icon={faSpinner} spin />
      </div>
    )
  }

  return (
    <EventStoreProvider eventStore={eventStore}>
      <AccountsProvider manager={accountManager}>
        <BrowserRouter>
          <div className="app">
            <Routes>
              <Route 
                path="/a/:naddr" 
                element={
                  <Bookmarks 
                    relayPool={relayPool}
                    onLogout={() => {
                      if (accountManager) {
                        accountManager.setActive(undefined as never)
                        localStorage.removeItem('active')
                        showToast('Logged out successfully')
                        console.log('Logged out')
                      }
                    }}
                  />
                } 
              />
              <Route path="/" element={<Navigate to={`/a/${DEFAULT_ARTICLE}`} replace />} />
              <Route path="/login" element={<Login onLogin={() => showToast('Logged in successfully')} />} />
            </Routes>
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
  )
}

export default App
