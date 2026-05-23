import type { ArticleMetadata } from './ogStore.js'

const DEFAULT_TITLE = 'Read on Boris'
const DEFAULT_SUMMARY = 'Read this article on Boris'
const DEFAULT_IMAGE = '/boris-social-1200.png'
const DEFAULT_AUTHOR = 'Boris'

function pickMeta(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return ''
}

export async function fetchArticleMetadataViaGateway(naddr: string): Promise<ArticleMetadata | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    try {
      const url = `https://njump.to/${encodeURIComponent(naddr)}`
      const resp = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'Boris OG fetcher'
        }
      })

      if (!resp.ok) {
        console.error(`Gateway fetch failed: ${resp.status} ${resp.statusText} for ${url}`)
        return null
      }

      const html = await resp.text()

      const title = pickMeta(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i
      ])

      const summary = pickMeta(html, [
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      ])

      const image = pickMeta(html, [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
      ])

      const author = pickMeta(html, [
        /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i
      ])

      if (!title && !summary && !image) {
        console.log(`No OG metadata found via gateway for ${naddr}`)
        return null
      }

      return {
        title: title || DEFAULT_TITLE,
        summary: summary || DEFAULT_SUMMARY,
        image: image || DEFAULT_IMAGE,
        author: author || DEFAULT_AUTHOR
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    console.error('Failed to fetch article metadata via gateway:', err)
    return null
  }
}

export async function fetchArticleMetadataViaRelays(naddr: string): Promise<ArticleMetadata | null> {
  return fetchArticleMetadataViaGateway(naddr)
}
