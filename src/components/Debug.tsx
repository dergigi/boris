/* global __APP_VERSION__, __GIT_COMMIT__, __GIT_COMMIT_URL__, __RELEASE_URL__ */
import React, { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { DebugBus, type DebugLogEntry } from '../utils/debugBus'

const defaultPayload = 'The quick brown fox jumps over the lazy dog.'

const Debug: React.FC = () => {
  const activeAccount = Hooks.useActiveAccount()
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

  useEffect(() => {
    return DebugBus.subscribe((e) => setLogs(prev => [...prev, e].slice(-300)))
  }, [])

  const signer = useMemo(() => (activeAccount as unknown as { signer?: unknown })?.signer, [activeAccount])
  const pubkey = (activeAccount as unknown as { pubkey?: string })?.pubkey

  const hasNip04 = typeof (signer as { nip04?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip04?.encrypt === 'function'
  const hasNip44 = typeof (signer as { nip44?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip44?.encrypt === 'function'

  const doEncrypt = async (mode: 'nip44' | 'nip04') => {
    if (!signer || !pubkey) return
    try {
      const api = (signer as any)[mode]
      DebugBus.info('debug', `encrypt start ${mode}`, { pubkey, len: payload.length })
      const start = performance.now()
      const cipher = await api.encrypt(pubkey, payload)
      const ms = Math.round(performance.now() - start)
      DebugBus.info('debug', `encrypt done ${mode}`, { len: typeof cipher === 'string' ? cipher.length : -1, ms })
      if (mode === 'nip44') setCipher44(cipher)
      else setCipher04(cipher)
      if (mode === 'nip44') setTEncrypt44(ms)
      else setTEncrypt04(ms)
    } catch (e) {
      DebugBus.error('debug', `encrypt error ${mode}`, e instanceof Error ? e.message : String(e))
    }
  }

  const doDecrypt = async (mode: 'nip44' | 'nip04') => {
    if (!signer || !pubkey) return
    try {
      const api = (signer as any)[mode]
      const cipher = mode === 'nip44' ? cipher44 : cipher04
      if (!cipher) {
        DebugBus.warn('debug', `no cipher to decrypt for ${mode}`)
        return
      }
      DebugBus.info('debug', `decrypt start ${mode}`, { len: cipher.length })
      const start = performance.now()
      const plain = await api.decrypt(pubkey, cipher)
      const ms = Math.round(performance.now() - start)
      DebugBus.info('debug', `decrypt done ${mode}`, { len: typeof plain === 'string' ? plain.length : -1, ms })
      if (mode === 'nip44') setPlain44(String(plain))
      else setPlain04(String(plain))
      if (mode === 'nip44') setTDecrypt44(ms)
      else setTDecrypt04(ms)
    } catch (e) {
      DebugBus.error('debug', `decrypt error ${mode}`, e instanceof Error ? e.message : String(e))
    }
  }

  const toggleDebug = () => {
    const next = !debugEnabled
    setDebugEnabled(next)
    if (next) localStorage.setItem('debug', '*')
    else localStorage.removeItem('debug')
  }

  const CodeBox = ({ value }: { value: string }) => (
    <pre
      className="textarea"
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
    >{value || '—'}</pre>
  )

  const Stat = ({ label, value }: { label: string; value?: string | number | null }) => (
    <span className="badge" style={{ marginRight: 8 }}>
      <FontAwesomeIcon icon={faClock} style={{ marginRight: 4, fontSize: '0.8em' }} />
      {label}: {value ?? '—'}
    </span>
  )

  return (
    <div className="content-panel" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Bunker Debug</h2>
        <div className="flex items-center gap-2 mb-3">
          <button className="btn btn-outline" onClick={toggleDebug}>
            {debugEnabled && <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />}
            {debugEnabled ? 'Hide' : 'Show'} all applesauce debug logs
          </button>
          <button className="btn btn-secondary" onClick={() => setLogs([])}>Clear logs</button>
          <span className="opacity-70">Active pubkey:</span> <code className="text-sm">{pubkey || 'none'}</code>
        </div>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold mb-3">Payload</h3>
            <textarea className="textarea w-full" value={payload} onChange={e => setPayload(e.target.value)} rows={3} />
            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary" onClick={() => doEncrypt('nip44')} disabled={!hasNip44}>Encrypt (nip44)</button>
              <button className="btn btn-secondary" onClick={() => doEncrypt('nip04')} disabled={!hasNip04}>Encrypt (nip04)</button>
              <button className="btn btn-secondary" onClick={() => { setCipher44(''); setCipher04(''); setPlain44(''); setPlain04(''); setTEncrypt44(null); setTEncrypt04(null); setTDecrypt44(null); setTDecrypt04(null) }}>Clear</button>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-3">nip44</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Stat label="enc" value={tEncrypt44 !== null ? `${tEncrypt44}ms` : null} />
                <Stat label="dec" value={tDecrypt44 !== null ? `${tDecrypt44}ms` : null} />
              </div>
              <label className="block text-sm opacity-70 mb-2">cipher</label>
              <CodeBox value={cipher44} />
              <div className="flex gap-2 mt-3">
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip44')} disabled={!cipher44}>Decrypt (nip44)</button>
                <span className="text-sm opacity-70">Plain:</span>
              </div>
              <CodeBox value={plain44} />
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-3">nip04</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Stat label="enc" value={tEncrypt04 !== null ? `${tEncrypt04}ms` : null} />
                <Stat label="dec" value={tDecrypt04 !== null ? `${tDecrypt04}ms` : null} />
              </div>
              <label className="block text-sm opacity-70 mb-2">cipher</label>
              <CodeBox value={cipher04} />
              <div className="flex gap-2 mt-3">
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip04')} disabled={!cipher04}>Decrypt (nip04)</button>
                <span className="text-sm opacity-70">Plain:</span>
              </div>
              <CodeBox value={plain04} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold mb-3">Live Logs</h3>
            <div className="text-sm opacity-70 mb-3">Recent NIP-46 activity</div>
            <div className="max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
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
          </div>
        </div>
      </div>

      <div className="text-center opacity-50 text-sm mt-4">
        <span>
          {typeof __RELEASE_URL__ !== 'undefined' && __RELEASE_URL__ ? (
            <a href={__RELEASE_URL__} target="_blank" rel="noopener noreferrer">
              Version {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
            </a>
          ) : (
            `Version ${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`
          )}
        </span>
        {typeof __GIT_COMMIT__ !== 'undefined' && __GIT_COMMIT__ ? (
          <span>
            {' '}·{' '}
            {typeof __GIT_COMMIT_URL__ !== 'undefined' && __GIT_COMMIT_URL__ ? (
              <a href={__GIT_COMMIT_URL__} target="_blank" rel="noopener noreferrer">
                <code>{__GIT_COMMIT__.slice(0, 7)}</code>
              </a>
            ) : (
              <code>{__GIT_COMMIT__.slice(0, 7)}</code>
            )}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default Debug
