import React, { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { Accounts } from 'applesauce-accounts'
import { NostrConnectSigner } from 'applesauce-signers'
import { getDefaultBunkerPermissions } from '../services/nostrConnect'
import { DebugBus, type DebugLogEntry } from '../utils/debugBus'
import VersionFooter from './VersionFooter'

const defaultPayload = 'The quick brown fox jumps over the lazy dog.'

const Debug: React.FC = () => {
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const [payload, setPayload] = useState<string>(defaultPayload)
  const [cipher44, setCipher44] = useState<string>('')
  const [cipher04, setCipher04] = useState<string>('')
  const [plain44, setPlain44] = useState<string>('')
  const [plain04, setPlain04] = useState<string>('')
  const [tEncrypt44, setTEncrypt44] = useState<number | null>(null)
  const [tEncrypt04, setTEncrypt04] = useState<number | null>(null)
  const [tDecrypt44, setTDecrypt44] = useState<number | null>(null)
  const [tDecrypt04, setTDecrypt04] = useState<number | null>(null)
  const [logs, setLogs] = useState<DebugLogEntry[]>(DebugBus.snapshot())
  const [debugEnabled, setDebugEnabled] = useState<boolean>(() => localStorage.getItem('debug') === '*')
  
  // Bunker login state
  const [bunkerUri, setBunkerUri] = useState<string>('')
  const [isBunkerLoading, setIsBunkerLoading] = useState<boolean>(false)
  const [bunkerError, setBunkerError] = useState<string | null>(null)
  
  // Live timing state
  const [liveTiming, setLiveTiming] = useState<{
    nip44?: { type: 'encrypt' | 'decrypt'; startTime: number }
    nip04?: { type: 'encrypt' | 'decrypt'; startTime: number }
  }>({})

  useEffect(() => {
    return DebugBus.subscribe((e) => setLogs(prev => [...prev, e].slice(-300)))
  }, [])

  // Live timer effect - triggers re-renders for live timing updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update live timing display
      setLiveTiming(prev => prev)
    }, 16) // ~60fps for smooth updates
    return () => clearInterval(interval)
  }, [])

  const signer = useMemo(() => (activeAccount as unknown as { signer?: unknown })?.signer, [activeAccount])
  const pubkey = (activeAccount as unknown as { pubkey?: string })?.pubkey

  const hasNip04 = typeof (signer as { nip04?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip04?.encrypt === 'function'
  const hasNip44 = typeof (signer as { nip44?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip44?.encrypt === 'function'

  const doEncrypt = async (mode: 'nip44' | 'nip04') => {
    if (!signer || !pubkey) return
    try {
      const api = (signer as { [key: string]: { encrypt: (pubkey: string, message: string) => Promise<string> } })[mode]
      DebugBus.info('debug', `encrypt start ${mode}`, { pubkey, len: payload.length })
      
      // Start live timing
      const start = performance.now()
      setLiveTiming(prev => ({ ...prev, [mode]: { type: 'encrypt', startTime: start } }))
      
      const cipher = await api.encrypt(pubkey, payload)
      const ms = Math.round(performance.now() - start)
      
      // Stop live timing
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      
      DebugBus.info('debug', `encrypt done ${mode}`, { len: typeof cipher === 'string' ? cipher.length : -1, ms })
      if (mode === 'nip44') setCipher44(cipher)
      else setCipher04(cipher)
      if (mode === 'nip44') setTEncrypt44(ms)
      else setTEncrypt04(ms)
    } catch (e) {
      // Stop live timing on error
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      DebugBus.error('debug', `encrypt error ${mode}`, e instanceof Error ? e.message : String(e))
    }
  }

  const doDecrypt = async (mode: 'nip44' | 'nip04') => {
    if (!signer || !pubkey) return
    try {
      const api = (signer as { [key: string]: { decrypt: (pubkey: string, ciphertext: string) => Promise<string> } })[mode]
      const cipher = mode === 'nip44' ? cipher44 : cipher04
      if (!cipher) {
        DebugBus.warn('debug', `no cipher to decrypt for ${mode}`)
        return
      }
      DebugBus.info('debug', `decrypt start ${mode}`, { len: cipher.length })
      
      // Start live timing
      const start = performance.now()
      setLiveTiming(prev => ({ ...prev, [mode]: { type: 'decrypt', startTime: start } }))
      
      const plain = await api.decrypt(pubkey, cipher)
      const ms = Math.round(performance.now() - start)
      
      // Stop live timing
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      
      DebugBus.info('debug', `decrypt done ${mode}`, { len: typeof plain === 'string' ? plain.length : -1, ms })
      if (mode === 'nip44') setPlain44(String(plain))
      else setPlain04(String(plain))
      if (mode === 'nip44') setTDecrypt44(ms)
      else setTDecrypt04(ms)
    } catch (e) {
      // Stop live timing on error
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      DebugBus.error('debug', `decrypt error ${mode}`, e instanceof Error ? e.message : String(e))
    }
  }

  const toggleDebug = () => {
    const next = !debugEnabled
    setDebugEnabled(next)
    if (next) localStorage.setItem('debug', '*')
    else localStorage.removeItem('debug')
  }

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setBunkerError('Please enter a bunker URI')
      return
    }

    if (!bunkerUri.startsWith('bunker://')) {
      setBunkerError('Invalid bunker URI. Must start with bunker://')
      return
    }

    try {
      setIsBunkerLoading(true)
      setBunkerError(null)
      
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
    } catch (err) {
      console.error('[bunker] Login failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to bunker'
      
      // Check for permission-related errors
      if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('unauthorized')) {
        setBunkerError('Your bunker connection is missing signing permissions. Reconnect and approve signing.')
      } else {
        setBunkerError(errorMessage)
      }
    } finally {
      setIsBunkerLoading(false)
    }
  }

  const CodeBox = ({ value }: { value: string }) => (
    <div className="h-20 overflow-y-auto font-mono text-xs leading-relaxed p-2 bg-gray-100 dark:bg-gray-800 rounded whitespace-pre-wrap break-all">
      {value || '—'}
    </div>
  )

  const getLiveTiming = (mode: 'nip44' | 'nip04', type: 'encrypt' | 'decrypt') => {
    const timing = liveTiming[mode]
    if (timing && timing.type === type) {
      const elapsed = Math.round(performance.now() - timing.startTime)
      return elapsed
    }
    return null
  }

  const Stat = ({ label, value, mode, type }: { 
    label: string; 
    value?: string | number | null;
    mode?: 'nip44' | 'nip04';
    type?: 'encrypt' | 'decrypt';
  }) => {
    const liveValue = mode && type ? getLiveTiming(mode, type) : null
    const isLive = !!liveValue
    
    let displayValue: string
    if (isLive) {
      displayValue = ''
    } else if (value !== null && value !== undefined) {
      displayValue = `${value}ms`
    } else {
      displayValue = '—'
    }
    
    return (
      <span className="badge" style={{ marginRight: 8 }}>
        <FontAwesomeIcon icon={faClock} style={{ marginRight: 4, fontSize: '0.8em' }} />
        {label}: {isLive ? (
          <FontAwesomeIcon icon={faSpinner} className="animate-spin" style={{ fontSize: '0.8em' }} />
        ) : (
          displayValue
        )}
      </span>
    )
  }

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Debug</h2>
        <div className="settings-header-actions">
          <span className="opacity-70">Active pubkey:</span> <code className="text-sm">{pubkey || 'none'}</code>
        </div>
      </div>

      <div className="settings-content">

        {/* Bunker Login Section */}
        <div className="settings-section">
          <h3 className="section-title">Bunker Connection</h3>
          {!activeAccount ? (
            <div>
              <div className="text-sm opacity-70 mb-3">Connect to your bunker (Nostr Connect signer) to enable encryption/decryption testing</div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="bunker://..."
                  value={bunkerUri}
                  onChange={(e) => setBunkerUri(e.target.value)}
                  disabled={isBunkerLoading}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleBunkerLogin}
                  disabled={isBunkerLoading || !bunkerUri.trim()}
                >
                  {isBunkerLoading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              {bunkerError && (
                <div className="text-sm text-red-600 dark:text-red-400 mb-2">{bunkerError}</div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-70">Connected to bunker</div>
                <div className="text-sm font-mono">{pubkey}</div>
              </div>
              <button 
                className="btn btn-outline" 
                onClick={() => accountManager.removeAccount(activeAccount)}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Encryption Tools Section */}
        <div className="settings-section">
          <h3 className="section-title">Encryption Tools</h3>
          <div className="setting-group">
            <label className="setting-label">Payload</label>
                <textarea 
                  className="textarea w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700" 
                  value={payload} 
                  onChange={e => setPayload(e.target.value)} 
                  rows={3} 
                />
            <div className="flex gap-2 mt-3 justify-end">
              <button className="btn btn-secondary" onClick={() => { setCipher44(''); setCipher04(''); setPlain44(''); setPlain04(''); setTEncrypt44(null); setTEncrypt04(null); setTDecrypt44(null); setTDecrypt04(null) }}>Clear</button>
            </div>
          </div>
          
          <div className="grid" style={{ gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <div className="setting-group">
              <label className="setting-label">NIP-44</label>
              <label className="block text-sm opacity-70 mb-2">cipher</label>
              <CodeBox value={cipher44} />
              <div className="flex gap-2 mt-3 justify-end">
                <button className="btn btn-primary" onClick={() => doEncrypt('nip44')} disabled={!hasNip44}>Encrypt</button>
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip44')} disabled={!cipher44}>Decrypt</button>
              </div>
              <div className="mt-3">
                <span className="text-sm opacity-70">Plain:</span>
                <CodeBox value={plain44} />
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">NIP-04</label>
              <label className="block text-sm opacity-70 mb-2">cipher</label>
              <CodeBox value={cipher04} />
              <div className="flex gap-2 mt-3 justify-end">
                <button className="btn btn-primary" onClick={() => doEncrypt('nip04')} disabled={!hasNip04}>Encrypt</button>
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip04')} disabled={!cipher04}>Decrypt</button>
              </div>
              <div className="mt-3">
                <span className="text-sm opacity-70">Plain:</span>
                <CodeBox value={plain04} />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Timing Section */}
        <div className="settings-section">
          <h3 className="section-title">Performance Timing</h3>
          <div className="text-sm opacity-70 mb-3">Encryption and decryption operation durations</div>
          <div className="grid" style={{ gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <div className="setting-group">
              <label className="setting-label">NIP-44</label>
              <div className="flex flex-wrap items-center gap-2">
                <Stat label="enc" value={tEncrypt44} mode="nip44" type="encrypt" />
                <Stat label="dec" value={tDecrypt44} mode="nip44" type="decrypt" />
              </div>
            </div>
            <div className="setting-group">
              <label className="setting-label">NIP-04</label>
              <div className="flex flex-wrap items-center gap-2">
                <Stat label="enc" value={tEncrypt04} mode="nip04" type="encrypt" />
                <Stat label="dec" value={tDecrypt04} mode="nip04" type="decrypt" />
              </div>
            </div>
          </div>
        </div>

        {/* Debug Logs Section */}
        <div className="settings-section">
          <h3 className="section-title">Debug Logs</h3>
          <div className="text-sm opacity-70 mb-3">Recent bunker logs:</div>
            <div className="max-h-192 overflow-y-auto font-mono text-xs leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-sm opacity-50 italic">No logs yet</div>
            ) : (
              logs.slice(-200).map((l, i) => (
                <div key={i} className="mb-1 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="opacity-70">[{new Date(l.ts).toLocaleTimeString()}]</span> <span className="font-semibold">{l.level.toUpperCase()}</span> {l.source}: {l.message}
                  {l.data !== undefined && (
                    <span className="opacity-70"> — {typeof l.data === 'string' ? l.data : JSON.stringify(l.data)}</span>
                  )}
                </div>
              ))
            )}
          </div>
            <div className="mt-3">
              <div className="flex justify-end mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={debugEnabled}
                    onChange={toggleDebug}
                    className="checkbox"
                  />
                  <span className="text-sm">Show all applesauce debug logs</span>
                </label>
              </div>
              <div className="flex justify-end">
                <button className="btn btn-secondary" onClick={() => setLogs([])}>Clear logs</button>
              </div>
            </div>
        </div>
      </div>

      <VersionFooter />
    </div>
  )
}

export default Debug
