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
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
    >{value || '—'}</pre>
  )

  const Stat = ({ label, value }: { label: string; value?: string | number | null }) => (
    <span className="badge" style={{ marginRight: 8 }}>{label}: {value ?? '—'}</span>
  )

  return (
    <div className="content-panel">
      <h2>Debug / NIP-46 Tools</h2>

      <div className="flex items-center gap-2 mb-3">
        <button className="btn btn-outline" onClick={toggleDebug}>{debugEnabled ? 'Disable' : 'Enable'} debug logs</button>
        <button className="btn btn-ghost" onClick={() => setLogs([])}>Clear logs</button>
        <span className="opacity-70">Active pubkey:</span> <code>{pubkey || 'none'}</code>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="card">
          <div className="card-body">
            <h3>Payload</h3>
            <textarea className="textarea" value={payload} onChange={e => setPayload(e.target.value)} rows={3} />
            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary" onClick={() => doEncrypt('nip44')} disabled={!hasNip44}>Encrypt (nip44)</button>
              <button className="btn" onClick={() => doEncrypt('nip04')} disabled={!hasNip04}>Encrypt (nip04)</button>
              <button className="btn btn-outline" onClick={() => { setCipher44(''); setCipher04(''); setPlain44(''); setPlain04(''); setTEncrypt44(null); setTEncrypt04(null); setTDecrypt44(null); setTDecrypt04(null) }}>Clear</button>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
          <div className="card">
            <div className="card-body">
              <h3>nip44</h3>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Stat label="enc" value={tEncrypt44 !== null ? `${tEncrypt44}ms` : null} />
                <Stat label="dec" value={tDecrypt44 !== null ? `${tDecrypt44}ms` : null} />
              </div>
              <label className="opacity-70">cipher</label>
              <CodeBox value={cipher44} />
              <div className="flex gap-2 mt-2">
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip44')} disabled={!cipher44}>Decrypt (nip44)</button>
                <span>Plain:</span>
              </div>
              <CodeBox value={plain44} />
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3>nip04</h3>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Stat label="enc" value={tEncrypt04 !== null ? `${tEncrypt04}ms` : null} />
                <Stat label="dec" value={tDecrypt04 !== null ? `${tDecrypt04}ms` : null} />
              </div>
              <label className="opacity-70">cipher</label>
              <CodeBox value={cipher04} />
              <div className="flex gap-2 mt-2">
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip04')} disabled={!cipher04}>Decrypt (nip04)</button>
                <span>Plain:</span>
              </div>
              <CodeBox value={plain04} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3>Live Logs</h3>
            <div style={{ maxHeight: 300, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4 }}>
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
    </div>
  )
}

export default Debug
