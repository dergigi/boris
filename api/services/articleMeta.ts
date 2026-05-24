import type { ArticleMetadata } from './articleMetadata.js'

const DEFAULT_TITLE = 'Read on Boris'
const DEFAULT_SUMMARY = 'Read this article on Boris'
const DEFAULT_IMAGE = '/boris-social-1200.png'
const DEFAULT_AUTHOR = 'Boris'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function metaPattern(attribute: 'name' | 'property', value: string): RegExp {
  return new RegExp(
    `<meta(?=[^>]*\\b${attribute}=["']${escapeRegExp(value)}["'])(?=[^>]*\\bcontent=["']([^"']+)["'])[^>]*>`,
    'i'
  )
}

function pickMeta(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return ''
}

export async function fetchArticleMetadata(naddr: string): Promise<ArticleMetadata | null> {
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
        metaPattern('property', 'og:title'),
        metaPattern('name', 'twitter:title'),
        /<title[^>]*>([^<]+)<\/title>/i
      ])

      const summary = pickMeta(html, [
        metaPattern('property', 'og:description'),
        metaPattern('name', 'twitter:description'),
        metaPattern('name', 'description')
      ])

      const image = pickMeta(html, [
        metaPattern('property', 'og:image'),
        metaPattern('name', 'twitter:image')
      ])

      const author = pickMeta(html, [
        metaPattern('property', 'article:author'),
        metaPattern('name', 'author')
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
