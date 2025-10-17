export type DebugLevel = 'info' | 'warn' | 'error'

export interface DebugLogEntry {
  ts: number
  level: DebugLevel
  source: string
  message: string
  data?: unknown
}

type Listener = (entry: DebugLogEntry) => void

const listeners = new Set<Listener>()
const buffer: DebugLogEntry[] = []
const MAX_BUFFER = 300

export const DebugBus = {
  log(level: DebugLevel, source: string, message: string, data?: unknown): void {
    const entry: DebugLogEntry = { ts: Date.now(), level, source, message, data }
    buffer.push(entry)
    if (buffer.length > MAX_BUFFER) buffer.shift()
    listeners.forEach(l => {
      try { l(entry) } catch {}
    })
  },
  info(source: string, message: string, data?: unknown): void { this.log('info', source, message, data) },
  warn(source: string, message: string, data?: unknown): void { this.log('warn', source, message, data) },
  error(source: string, message: string, data?: unknown): void { this.log('error', source, message, data) },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  snapshot(): DebugLogEntry[] { return buffer.slice() }
}


