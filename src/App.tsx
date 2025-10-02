import { useState, useEffect } from 'react'
import { EventStoreProvider, AccountsProvider } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import { AccountManager } from 'applesauce-accounts'
import Login from './components/Login'
import Bookmarks from './components/Bookmarks'

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Initialize event store and account manager
    const store = new EventStore()
    const accounts = new AccountManager()
    setEventStore(store)
    setAccountManager(accounts)
  }, [])

  if (!eventStore || !accountManager) {
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
            <Bookmarks onLogout={() => setIsAuthenticated(false)} />
          )}
        </div>
      </AccountsProvider>
    </EventStoreProvider>
  )
}

export default App
