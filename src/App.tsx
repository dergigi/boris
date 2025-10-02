import { useState, useEffect } from 'react'
import { EventStoreProvider, AccountsProvider } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager } from 'applesauce-accounts'
import { RelayPool } from 'applesauce-relay'
import { createAddressLoader } from 'applesauce-loaders/loaders'
import Login from './components/Login'
import Bookmarks from './components/Bookmarks'

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [relayPool, setRelayPool] = useState<RelayPool | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Initialize event store, account manager, and relay pool
    const store = new EventStore()
    const accounts = new AccountManager()
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
  }, [])

  if (!eventStore || !accountManager || !relayPool) {
    return <div>Loading...</div>
  }

  return (
    <EventStoreProvider eventStore={eventStore}>
      <AccountsProvider manager={accountManager}>
        <div className="app">
          {!isAuthenticated ? (
            <Login onLogin={() => setIsAuthenticated(true)} />
          ) : (
            <Bookmarks 
              relayPool={relayPool}
              onLogout={() => setIsAuthenticated(false)} 
            />
          )}
        </div>
      </AccountsProvider>
    </EventStoreProvider>
  )
}

export default App
