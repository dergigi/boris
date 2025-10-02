// Lightweight readability-style fetcher using r.jina.ai proxy
// Returns simplified HTML for a given URL. This avoids CORS and heavy deps.

export interface ReadableContent {
  url: string
  title?: string
  html?: string
  markdown?: string
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
  const text = await res.text()
  // Detect if the proxy delivered Markdown or HTML. r.jina.ai often returns a
  // block starting with "Title:" and "Markdown Content:". We handle both.
  const hasMarkdownBlock = /Markdown Content:\s/i.test(text)

  if (hasMarkdownBlock) {
    // Try to split out Title and the Markdown payload
    const titleMatch = text.match(/Title:\s*(.*?)(?:\s+URL Source:|\s+Markdown Content:)/i)
    const mdMatch = text.match(/Markdown Content:\s*([\s\S]*)$/i)
    return {
      url: targetUrl,
      title: titleMatch?.[1]?.trim(),
      markdown: mdMatch?.[1]?.trim()
    }
  }

  const html = text
  // Best-effort title extraction from HTML
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
  return {
    url: targetUrl,
    title: match?.[1],
    html
  }
}


