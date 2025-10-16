import React, { useState } from 'react'
import { Hooks } from 'applesauce-react'
import { Accounts } from 'applesauce-accounts'
import { NostrConnectSigner } from 'applesauce-signers'
import { getDefaultBunkerPermissions } from '../services/nostrConnect'

const LoginOptions: React.FC = () => {
  const accountManager = Hooks.useAccountManager()
  const [showBunkerInput, setShowBunkerInput] = useState(false)
  const [bunkerUri, setBunkerUri] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExtensionLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const account = await Accounts.ExtensionAccount.fromExtension()
      accountManager.addAccount(account)
      accountManager.setActive(account)
    } catch (err) {
      console.error('Extension login failed:', err)
      setError('Login failed. Please install a nostr browser extension and try again.')
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
      
      // Validate: remote (Amber) pubkey must not equal user pubkey
      if ((signer as any).remote === pubkey) {
        console.error('[bunker] Invalid bunker URI: remote pubkey equals user pubkey')
        setError('Invalid bunker URI (remote equals your pubkey). Generate a fresh Connect link in Amber and try again.')
        return
      }
      
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
    <div className="empty-state">
      <p style={{ marginBottom: '1rem' }}>Login with:</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '300px', margin: '0 auto' }}>
        <button
          onClick={handleExtensionLogin}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading && !showBunkerInput ? 'Connecting...' : 'Extension'}
        </button>
        
        {!showBunkerInput ? (
          <button
            onClick={() => setShowBunkerInput(true)}
            disabled={isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            Bunker
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="bunker://..."
              value={bunkerUri}
              onChange={(e) => setBunkerUri(e.target.value)}
              disabled={isLoading}
              style={{
                padding: '0.75rem',
                fontSize: '0.9rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBunkerLogin()
                }
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleBunkerLogin}
                disabled={isLoading || !bunkerUri.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  flex: 1,
                  cursor: isLoading || !bunkerUri.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !bunkerUri.trim() ? 0.6 : 1
                }}
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
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <p style={{ color: 'var(--color-error, #ef4444)', marginTop: '1rem', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}
      
      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        If you aren't on nostr yet, start here:{' '}
        <a href="https://nstart.me/" target="_blank" rel="noopener noreferrer">
          nstart.me
        </a>
      </p>
    </div>
  )
}

export default LoginOptions

