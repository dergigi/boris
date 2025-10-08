// Lightweight readability-style fetcher using r.jina.ai proxy
// Returns simplified HTML for a given URL. This avoids CORS and heavy deps.

export interface ReadableContent {
  url: string
  title?: string
  html?: string
  markdown?: string
  image?: string
}

interface CachedContent {
  content: ReadableContent
  timestamp: number
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const CACHE_PREFIX = 'reader_cache_'

function getCacheKey(url: string): string {
  return `${CACHE_PREFIX}${url}`
}

function getFromCache(url: string): ReadableContent | null {
  try {
    const cacheKey = getCacheKey(url)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { content, timestamp }: CachedContent = JSON.parse(cached)
    const age = Date.now() - timestamp

    if (age > CACHE_TTL) {
      localStorage.removeItem(cacheKey)
      return null
    }

    return content
  } catch {
    return null
  }
}

function saveToCache(url: string, content: ReadableContent): void {
  try {
    const cacheKey = getCacheKey(url)
    const cached: CachedContent = {
      content,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
  } catch {
    // Silently fail if storage is full or unavailable
  }
}

function toProxyUrl(url: string): string {
  // Ensure the target URL has a protocol and build the proxy URL
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  return `https://r.jina.ai/${normalized}`
}

export async function fetchReadableContent(
  targetUrl: string,
  bypassCache = false
): Promise<ReadableContent> {
  // Check cache first unless bypassed
  if (!bypassCache) {
    const cached = getFromCache(targetUrl)
    if (cached) return cached
  }

  const proxyUrl = toProxyUrl(targetUrl)
  const res = await fetch(proxyUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch readable content (${res.status})`)
  }
  const text = await res.text()
  // Detect if the proxy delivered Markdown or HTML. r.jina.ai often returns a
  // block starting with "Title:" and "Markdown Content:". We handle both.
  const hasMarkdownBlock = /Markdown Content:\s/i.test(text)

  let content: ReadableContent

  if (hasMarkdownBlock) {
    // Try to split out Title and the Markdown payload
    const titleMatch = text.match(/Title:\s*(.*?)(?:\s+URL Source:|\s+Markdown Content:)/i)
    const mdMatch = text.match(/Markdown Content:\s*([\s\S]*)$/i)
    content = {
      url: targetUrl,
      title: titleMatch?.[1]?.trim(),
      markdown: mdMatch?.[1]?.trim()
    }
  } else {
    const html = text
    // Best-effort title extraction from HTML
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
    content = {
      url: targetUrl,
      title: match?.[1],
      html
    }
  }

  // Save to cache before returning
  saveToCache(targetUrl, content)
  return content
}


