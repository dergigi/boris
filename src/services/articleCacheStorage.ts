// Reserve space for accounts/settings and prevent background relay bursts from
// crowding out web articles the user deliberately opened. Budgets are UTF-16 units.
const MAX_UNITS = 1_500_000
const MAX_ENTRIES = 100
const isArticleKey = (key: string) => key.startsWith('article_cache_') || key.startsWith('reader_cache_')

export function saveArticleCache(key: string, value: string): boolean {
  if (!isArticleKey(key) || key.length + value.length > MAX_UNITS) return false
  try {
    const entries: Array<{ key: string; units: number; timestamp: number }> = []
    for (let i = 0; i < localStorage.length; i++) {
      const candidate = localStorage.key(i)
      if (!candidate || candidate === key || !isArticleKey(candidate)) continue
      const raw = localStorage.getItem(candidate) || ''
      let timestamp = 0
      try { timestamp = Number(JSON.parse(raw).timestamp) || 0 } catch { /* Evict corrupt entries first. */ }
      entries.push({ key: candidate, units: candidate.length + raw.length, timestamp })
    }
    // Background article writes may evict background articles, never web reads.
    const candidates = entries.filter(entry => key.startsWith('reader_cache_') || entry.key.startsWith('article_cache_'))
      .sort((a, b) => Number(a.key.startsWith('reader_cache_')) - Number(b.key.startsWith('reader_cache_')) || a.timestamp - b.timestamp)
    let units = entries.reduce((sum, entry) => sum + entry.units, key.length + value.length)
    let count = entries.length + 1
    const evict = () => {
      const entry = candidates.shift()
      if (!entry) return false
      localStorage.removeItem(entry.key)
      units -= entry.units
      count--
      return true
    }
    while (units > MAX_UNITS || count > MAX_ENTRIES) {
      if (!evict()) return false
    }
    // Other caches may already consume the remaining quota. Retry by dropping
    // disposable article entries only; never clear accounts, settings or drafts.
    for (;;) {
      try { localStorage.setItem(key, value); return true } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError' || !evict()) return false
      }
    }
  } catch { return false }
}
