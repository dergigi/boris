import { saveArticleCache } from './articleCacheStorage'

// Article extraction runs on Boris' own server; no external extraction service.
export interface ReadableContent {
  url: string
  title?: string
  html?: string
  markdown?: string
  image?: string
  summary?: string
  published?: number
  error?: string
  stale?: boolean
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'reader_cache_v2_'

export function normalizeReaderUrl(input: string): string {
  const value = input.trim()
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Enter a public HTTP or HTTPS URL.')
  }
  url.hash = ''
  return url.href
}

function isContent(value: unknown): value is ReadableContent {
  if (!value || typeof value !== 'object') return false
  const c = value as ReadableContent
  return typeof c.url === 'string' &&
    ((typeof c.html === 'string' && !!c.html.trim()) || (typeof c.markdown === 'string' && !!c.markdown.trim())) &&
    ['title', 'image', 'summary'].every(key => c[key as keyof ReadableContent] === undefined || typeof c[key as keyof ReadableContent] === 'string') &&
    (c.published === undefined || (typeof c.published === 'number' && Number.isFinite(c.published)))
}

function getCached(url: string) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${url}`) || 'null')
    if (cached && isContent(cached.content) && cached.content.url === url &&
        Number.isFinite(cached.timestamp) && cached.timestamp <= Date.now()) return cached as { content: ReadableContent; timestamp: number }
  } catch { /* Storage can be unavailable or corrupt. */ }
  return null
}

export async function fetchReadableContent(targetUrl: string, bypassCache = false, signal?: AbortSignal): Promise<ReadableContent> {
  const url = normalizeReaderUrl(targetUrl)
  const cached = getCached(url)
  if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.content
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 20_000)
  try {
    const res = await fetch(`/api/reader?${new URLSearchParams({ url })}`, {
      signal: controller.signal, headers: { Accept: 'application/json' },
    })
    if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('The reader service is unavailable. Please try again.')
    const body: unknown = await res.json()
    if (!res.ok) {
      const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : `Unable to load article (${res.status}).`
      throw new Error(message)
    }
    if (!isContent(body)) throw new Error('The reader returned no readable article.')
    const content = { ...body, url } // Preserve the requested URL for bookmark/highlight identity.
    saveArticleCache(`${CACHE_PREFIX}${url}`, JSON.stringify({ content, timestamp: Date.now() }))
    return content
  } catch (error) {
    if (signal?.aborted) throw error
    if (cached) return { ...cached.content, stale: true }
    if (controller.signal.aborted) throw new Error('The page took too long to load. Please try again.')
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
