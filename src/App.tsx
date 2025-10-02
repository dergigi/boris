import { useState, useEffect } from 'react'
import { EventStoreProvider, AccountsProvider } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager } from 'applesauce-accounts'
import { RelayPool } from 'applesauce-relay'
import { Loaders } from 'applesauce-loaders'
import Login from './components/Login'
import Bookmarks from './components/Bookmarks'

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [relayPool, setRelayPool] = useState<RelayPool | null>(null)
  const [addressLoader, setAddressLoader] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Initialize event store, account manager, and relay pool
    const store = new EventStore()
    const accounts = new AccountManager()
    const pool = new RelayPool()
    
    // Connect to some popular nostr relays
    pool.relay('wss://relay.damus.io')
    pool.relay('wss://nos.lol')
    pool.relay('wss://relay.snort.social')
    
    // Create address loader for fetching replaceable events (like bookmarks)
    const loader = Loaders.createAddressLoader(pool, {
      eventStore: store,
      bufferTime: 1000,
      followRelayHints: true,
      extraRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']
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
