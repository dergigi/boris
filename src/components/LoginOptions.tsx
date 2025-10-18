import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPuzzlePiece, faShieldHalved, faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { Accounts } from 'applesauce-accounts'
import { NostrConnectSigner } from 'applesauce-signers'
import { getDefaultBunkerPermissions } from '../services/nostrConnect'

const LoginOptions: React.FC = () => {
  const accountManager = Hooks.useAccountManager()
  const [showBunkerInput, setShowBunkerInput] = useState(false)
  const [bunkerUri, setBunkerUri] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<React.ReactNode | null>(null)

  const handleExtensionLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const account = await Accounts.ExtensionAccount.fromExtension()
      accountManager.addAccount(account)
      accountManager.setActive(account)
    } catch (err) {
      console.error('Extension login failed:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      // Check if extension is not installed
      if (errorMessage.includes('Signer extension missing') || errorMessage.includes('window.nostr') || errorMessage.includes('not found') || errorMessage.includes('undefined') || errorMessage.toLowerCase().includes('extension missing')) {
        setError(
          <>
            No browser extension found. Please install{' '}
            <a href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp" target="_blank" rel="noopener noreferrer">
              nos2x
            </a>
            {' '}or another nostr extension.
          </>
        )
      } else if (errorMessage.includes('denied') || errorMessage.includes('rejected') || errorMessage.includes('cancel')) {
        setError('Authentication was cancelled or denied.')
      } else {
        setError(`Authentication failed: ${errorMessage}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setError('Please enter a bunker URI')
      return
    }

    if (!bunkerUri.startsWith('bunker://')) {
      setError('Invalid bunker URI. Must start with bunker://')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      // Create signer from bunker URI with default permissions
      const permissions = getDefaultBunkerPermissions()
      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, { permissions })
      
      // Get pubkey from signer
      const pubkey = await signer.getPublicKey()
      
      // Create account from signer
      const account = new Accounts.NostrConnectAccount(pubkey, signer)
      
      // Add to account manager and set active
      accountManager.addAccount(account)
      accountManager.setActive(account)
      
      // Clear input on success
      setBunkerUri('')
      setShowBunkerInput(false)
    } catch (err) {
      console.error('[bunker] Login failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to bunker'
      
      // Check for permission-related errors
      if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('unauthorized')) {
        setError('Your bunker connection is missing signing permissions. Reconnect and approve signing.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="empty-state login-container">
      <div className="login-content">
        <h2 className="login-title">Hi! I'm Boris.</h2>
        <p className="login-description">
          Connect your nostr npub to see your bookmarks, explore long-form articles, and create <mark className="login-highlight">your own highlights</mark>.
        </p>
        
        <div className="login-buttons">
          {!showBunkerInput && (
            <button
              onClick={handleExtensionLogin}
              disabled={isLoading}
              className="login-button login-button-primary"
            >
              <FontAwesomeIcon icon={faPuzzlePiece} />
              <span>{isLoading ? 'Connecting...' : 'Extension'}</span>
            </button>
          )}
          
          {!showBunkerInput ? (
            <button
              onClick={() => setShowBunkerInput(true)}
              disabled={isLoading}
              className="login-button login-button-secondary"
            >
              <FontAwesomeIcon icon={faShieldHalved} />
              <span>Bunker</span>
            </button>
          ) : (
            <div className="bunker-input-container">
              <input
                type="text"
                placeholder="bunker://..."
                value={bunkerUri}
                onChange={(e) => setBunkerUri(e.target.value)}
                disabled={isLoading}
                className="bunker-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleBunkerLogin()
                  }
                }}
              />
              <div className="bunker-actions">
                <button
                  onClick={handleBunkerLogin}
                  disabled={isLoading || !bunkerUri.trim()}
                  className="bunker-button bunker-connect"
                >
                  {isLoading && showBunkerInput ? 'Connecting...' : 'Connect'}
                </button>
                <button
                  onClick={() => {
                    setShowBunkerInput(false)
                    setBunkerUri('')
                    setError(null)
                  }}
                  disabled={isLoading}
                  className="bunker-button bunker-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div className="login-error">
            <FontAwesomeIcon icon={faCircleInfo} />
            <span>{error}</span>
          </div>
        )}
        
        <p className="login-footer">
          New to nostr? Start here:{' '}
          <a href="https://nstart.me/" target="_blank" rel="noopener noreferrer">
            nstart.me
          </a>
        </p>
      </div>
    </div>
  )
}

export default LoginOptions

