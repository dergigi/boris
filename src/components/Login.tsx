import { useState } from 'react'

interface UserProfile {
  name?: string
  username?: string
  nip05?: string
}

interface LoginProps {
  onLogin: (publicKey: string, profile: UserProfile) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isConnecting, setIsConnecting] = useState(false)

  const fetchUserProfile = async (publicKey: string): Promise<UserProfile> => {
    try {
      // Create a simple relay connection to fetch profile
      const relay = new WebSocket('wss://relay.damus.io')
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          relay.close()
          resolve({}) // Return empty profile if timeout
        }, 5000)

        relay.onopen = () => {
          // Request profile event (kind 0)
          relay.send(JSON.stringify([
            "REQ",
            "profile",
            {
              "kinds": [0],
              "authors": [publicKey]
            }
          ]))
        }

        relay.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data[0] === 'EVENT' && data[2]?.kind === 0) {
              const profileEvent = data[2]
              const profileContent = JSON.parse(profileEvent.content || '{}')
              
              clearTimeout(timeout)
              relay.close()
              
              resolve({
                name: profileContent.name,
                username: profileContent.username,
                nip05: profileContent.nip05
              })
            }
          } catch (error) {
            console.error('Error parsing profile:', error)
          }
        }

        relay.onerror = () => {
          clearTimeout(timeout)
          relay.close()
          resolve({}) // Return empty profile on error
        }
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
      return {}
    }
  }

  const handleLogin = async () => {
    try {
      setIsConnecting(true)
      
      // Check if nostr is available in the browser
      if (!window.nostr) {
        throw new Error('Nostr extension not found. Please install a nostr browser extension.')
      }

      // Request public key from nostr extension
      const publicKey = await window.nostr.getPublicKey()
      
      if (publicKey) {
        // Fetch user profile from nostr
        const profile = await fetchUserProfile(publicKey)
        onLogin(publicKey, profile)
      } else {
        throw new Error('Failed to get public key')
      }
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please install a nostr browser extension and try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Welcome to Markr</h2>
        <p>Connect your nostr account to view your bookmarks</p>
        <button 
          onClick={handleLogin} 
          disabled={isConnecting}
          className="login-button"
        >
          {isConnecting ? 'Connecting...' : 'Connect with Nostr'}
        </button>
      </div>
    </div>
  )
}

export default Login
