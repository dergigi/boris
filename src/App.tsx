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
    
    // Create a relay group for better event deduplication and management
    // This follows the applesauce-relay documentation pattern
    // Note: We could use pool.group(relayUrls) for direct requests in the future
    pool.group(relayUrls)
    console.log('Created relay group with', relayUrls.length, 'relays')
    console.log('Relay URLs:', relayUrls)
    
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
          <header>
            <h1>Markr</h1>
            <p>A minimal nostr bookmark client</p>
          </header>
          
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
