import React, { useMemo, useState } from 'react'
import { Hooks } from 'applesauce-react'

const Debug: React.FC = () => {
  const activeAccount = Hooks.useActiveAccount()
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')

  const signer = useMemo(() => (activeAccount as unknown as { signer?: unknown })?.signer, [activeAccount])
  const hasNip04 = typeof (signer as { nip04?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip04?.encrypt === 'function'
  const hasNip44 = typeof (signer as { nip44?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip44?.encrypt === 'function'
  const pubkey = (activeAccount as unknown as { pubkey?: string })?.pubkey

  const doRoundtrip = async (mode: 'nip04' | 'nip44') => {
    setResult('')
    setError('')
    if (!signer || !pubkey) {
      setError('No active signer/pubkey')
      return
    }
    try {
      const api = (signer as any)[mode]
      if (!api || typeof api.encrypt !== 'function' || typeof api.decrypt !== 'function') {
        setError(`${mode} not available on signer`)
        return
      }
      const cipher = await api.encrypt(pubkey, `debug-${mode}-${Date.now()}`)
      const plain = await api.decrypt(pubkey, cipher)
      setResult(String(plain))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="content-panel">
      <h2>Debug / NIP-46 Echo</h2>
      <div className="card">
        <div className="card-body">
          <div>Active pubkey: <code>{pubkey || 'none'}</code></div>
          <div>Signer has nip04: <strong>{hasNip04 ? 'yes' : 'no'}</strong></div>
          <div>Signer has nip44: <strong>{hasNip44 ? 'yes' : 'no'}</strong></div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary" onClick={() => doRoundtrip('nip44')} disabled={!hasNip44}>Probe nip44 encrypt→decrypt</button>
            <button className="btn" onClick={() => doRoundtrip('nip04')} disabled={!hasNip04}>Probe nip04 encrypt→decrypt</button>
          </div>
          {result && (
            <div className="alert alert-success mt-3">Plaintext: <code>{result}</code></div>
          )}
          {error && (
            <div className="alert alert-error mt-3">Error: {error}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Debug
