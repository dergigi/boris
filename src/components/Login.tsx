import React, { useState } from 'react'
import { Hooks } from 'applesauce-react'
import { Accounts } from 'applesauce-accounts'

interface LoginProps {
  onLogin: () => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const accountManager = Hooks.useAccountManager()

  const handleLogin = async () => {
    try {
      setIsConnecting(true)
      
      // Create account from nostr extension
      const account = await Accounts.ExtensionAccount.fromExtension()
      accountManager.addAccount(account)
      accountManager.setActive(account)
      onLogin()
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
