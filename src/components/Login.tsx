import { useState } from 'react'

interface LoginProps {
  onLogin: (publicKey: string) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isConnecting, setIsConnecting] = useState(false)

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
        onLogin(publicKey)
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
