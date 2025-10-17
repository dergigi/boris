import React, { useEffect, useMemo, useState } from 'react'
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
      const cipher = await api.encrypt(pubkey, payload)
      DebugBus.info('debug', `encrypt done ${mode}`, { len: typeof cipher === 'string' ? cipher.length : -1 })
      if (mode === 'nip44') setCipher44(cipher)
      else setCipher04(cipher)
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
      const plain = await api.decrypt(pubkey, cipher)
      DebugBus.info('debug', `decrypt done ${mode}`, { len: typeof plain === 'string' ? plain.length : -1 })
      if (mode === 'nip44') setPlain44(String(plain))
      else setPlain04(String(plain))
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

  return (
    <div className="content-panel">
      <h2>Debug / NIP-46 Tools</h2>
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2">
            <button className="btn btn-outline" onClick={toggleDebug}>{debugEnabled ? 'Disable' : 'Enable'} debug logs</button>
            <button className="btn btn-ghost" onClick={() => setLogs([])}>Clear logs</button>
          </div>
          <div>Active pubkey: <code>{pubkey || 'none'}</code></div>
          <div className="grid" style={{ gap: 8 }}>
            <label>Payload</label>
            <textarea className="textarea" value={payload} onChange={e => setPayload(e.target.value)} rows={3} />
            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary" onClick={() => doEncrypt('nip44')} disabled={!hasNip44}>Encrypt (nip44)</button>
              <button className="btn" onClick={() => doEncrypt('nip04')} disabled={!hasNip04}>Encrypt (nip04)</button>
              <button className="btn btn-outline" onClick={() => { setCipher44(''); setCipher04(''); setPlain44(''); setPlain04(''); }}>Clear</button>
            </div>
          </div>
          <div className="grid mt-3" style={{ gap: 8 }}>
            <label>nip44 cipher</label>
            <textarea className="textarea" value={cipher44} readOnly rows={2} />
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => doDecrypt('nip44')} disabled={!cipher44}>Decrypt (nip44)</button>
              <span>Plain: <code>{plain44}</code></span>
            </div>
          </div>
          <div className="grid mt-3" style={{ gap: 8 }}>
            <label>nip04 cipher</label>
            <textarea className="textarea" value={cipher04} readOnly rows={2} />
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => doDecrypt('nip04')} disabled={!cipher04}>Decrypt (nip04)</button>
              <span>Plain: <code>{plain04}</code></span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-body">
          <h3>Live Logs</h3>
          <div style={{ maxHeight: 260, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
            {logs.slice(-200).map((l, i) => (
              <div key={i}>
                [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()} {l.source}: {l.message}
                {l.data !== undefined && (
                  <span> — {typeof l.data === 'string' ? l.data : JSON.stringify(l.data)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Debug
