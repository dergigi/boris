import { useState, useEffect } from 'react'
import { EventStoreProvider } from 'applesauce-react'
import { EventStore } from 'applesauce-core'
import Login from './components/Login'
import Bookmarks from './components/Bookmarks'

function App() {
  const [eventStore, setEventStore] = useState<EventStore | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userPublicKey, setUserPublicKey] = useState<string | null>(null)

  useEffect(() => {
    // Initialize event store
    const store = new EventStore()
    setEventStore(store)
  }, [])

  if (!eventStore) {
    return <div>Loading...</div>
  }

  return (
    <EventStoreProvider eventStore={eventStore}>
      <div className="app">
        <header>
          <h1>Markr</h1>
          <p>A minimal nostr bookmark client</p>
        </header>
        
        {!isAuthenticated ? (
          <Login onLogin={(publicKey) => {
            setIsAuthenticated(true)
            setUserPublicKey(publicKey)
          }} />
        ) : (
          <Bookmarks 
            userPublicKey={userPublicKey}
            onLogout={() => {
              setIsAuthenticated(false)
              setUserPublicKey(null)
            }} 
          />
        )}
      </div>
    </EventStoreProvider>
  )
}

export default App
