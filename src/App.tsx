import { useState, useEffect } from 'react'
import { EventStoreProvider, AccountsProvider } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager } from 'applesauce-accounts'
import { RelayPool } from 'applesauce-relay'
import { Loaders } from 'applesauce-loaders'
import { NostrEvent } from 'nostr-tools'
import Login from './components/Login'
import Bookmarks from './components/Bookmarks'

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [relayPool, setRelayPool] = useState<RelayPool | null>(null)
  const [addressLoader, setAddressLoader] = useState<((params: { kind: number; pubkey: string; relays?: string[] }) => {
    subscribe: (observer: {
      next: (event: NostrEvent) => void;
      error: (error: unknown) => void;
      complete: () => void;
    }) => { unsubscribe: () => void };
  }) | null>(null)
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
      'wss://relay.snort.social',
      'wss://relay.nostr.band'
    ]
    
    // Connect to relays
    relayUrls.forEach(url => {
      console.log('Connecting to relay:', url)
      const relay = pool.relay(url)
      relay.on('connect', () => {
        console.log('Connected to relay:', url)
      })
      relay.on('error', (error) => {
        console.error('Relay connection error:', url, error)
      })
    })
    
    // Create address loader for fetching replaceable events (like bookmarks)
    // The pool will automatically handle multiple relays and deduplication
    const loader = Loaders.createAddressLoader(pool, {
      eventStore: store,
      bufferTime: 1000,
      followRelayHints: true,
      extraRelays: relayUrls
    })
    
    setEventStore(store)
    setAccountManager(accounts)
    setRelayPool(pool)
    setAddressLoader(loader)
  }, [])

  if (!eventStore || !accountManager || !relayPool || !addressLoader) {
    return <div>Loading...</div>
  }

  return (
    <EventStoreProvider eventStore={eventStore}>
      <AccountsProvider manager={accountManager}>
        <div className="app">
          <header>
            <h1>Markr</h1>
            <p>A minimal nostr bookmark client</p>
          </header>
          
          {!isAuthenticated ? (
            <Login onLogin={() => setIsAuthenticated(true)} />
          ) : (
            <Bookmarks 
              addressLoader={addressLoader}
              onLogout={() => setIsAuthenticated(false)} 
            />
          )}
        </div>
      </AccountsProvider>
    </EventStoreProvider>
  )
}

export default App
