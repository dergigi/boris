import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Hooks } from 'applesauce-react'
import { Accounts } from 'applesauce-accounts'

interface LoginProps {
  onLogin: () => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const accountManager = Hooks.useAccountManager()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogin = async () => {
    try {
      setIsConnecting(true)
      
      // Create account from nostr extension
      const account = await Accounts.ExtensionAccount.fromExtension()
      accountManager.addAccount(account)
      accountManager.setActive(account)
      onLogin()
      
      // Navigate back to where the user came from, or to the default article
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname
      if (from) {
        navigate(from, { replace: true })
      } else {
        const defaultArticle = import.meta.env.VITE_DEFAULT_ARTICLE_NADDR || 
          'naddr1qvzqqqr4gupzqmjxss3dld622uu8q25gywum9qtg4w4cv4064jmg20xsac2aam5nqqxnzd3cxqmrzv3exgmr2wfesgsmew'
        navigate(`/a/${defaultArticle}`)
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
        <h2>Welcome to Boris</h2>
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
