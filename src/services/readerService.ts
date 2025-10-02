// Lightweight readability-style fetcher using r.jina.ai proxy
// Returns simplified HTML for a given URL. This avoids CORS and heavy deps.

export interface ReadableContent {
  url: string
  title?: string
  html: string
}

function toProxyUrl(url: string): string {
  // Ensure the target URL has a protocol and build the proxy URL
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  return `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//, '')}`
}

export async function fetchReadableContent(targetUrl: string): Promise<ReadableContent> {
  const proxyUrl = toProxyUrl(targetUrl)
  const res = await fetch(proxyUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch readable content (${res.status})`)
  }
  const html = await res.text()
  // Best-effort title extraction
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
  return {
    url: targetUrl,
    title: match?.[1],
    html
  }
}


