import type { ArticleMetadata } from './articleMetadata.js'

const DEFAULT_TITLE = 'Read on Boris'
const DEFAULT_SUMMARY = 'Read this article on Boris'
const DEFAULT_IMAGE = '/boris-social-1200.png'
const DEFAULT_AUTHOR = 'Boris'
const SUMMARY_MAX_LENGTH = 220

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

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  }

  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, value: string) => {
    const normalized = value.toLowerCase()

    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    return namedEntities[normalized] || entity
  })
}

function stripHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(text)
    .replace(/\s+/g, ' ')
    .trim()
}

function clampSummary(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= SUMMARY_MAX_LENGTH) {
    return normalized
  }

  const truncated = normalized.slice(0, SUMMARY_MAX_LENGTH + 1)
  const lastSpace = truncated.lastIndexOf(' ')
  const boundary = lastSpace > SUMMARY_MAX_LENGTH * 0.7 ? lastSpace : SUMMARY_MAX_LENGTH

  return `${normalized.slice(0, boundary).trim()}…`
}

function cleanTitle(title: string): string {
  return stripHtml(title)
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickArticleHeadline(html: string): string {
  const headline = html.match(/<h1(?=[^>]*\bitemprop=["']headline["'])[^>]*>([\s\S]*?)<\/h1>/i)
  return headline?.[1] ? cleanTitle(headline[1]) : ''
}

function pickArticleBodySummary(html: string, title: string): string {
  const body = html.match(/<div(?=[^>]*\bitemprop=["']articleBody["'])[^>]*>([\s\S]*?)<\/div>/i)
  if (!body?.[1]) {
    return ''
  }

  const paragraphs = [...body[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => paragraph.length > 0 && paragraph !== title)

  const summary = paragraphs[0] || stripHtml(body[1])
  return clampSummary(summary)
}

function pickArticleAuthor(html: string, siteName: string): string {
  const authorName = html.match(/<span(?=[^>]*\bitemprop=["']name["'])[^>]*>([\s\S]*?)<\/span>/i)
  if (authorName?.[1]) {
    return stripHtml(authorName[1])
  }

  const alternateName = html.match(/<span(?=[^>]*\bitemprop=["']alternateName["'])[^>]*>([\s\S]*?)<\/span>/i)
  if (alternateName?.[1]) {
    return stripHtml(alternateName[1])
  }

  return stripHtml(siteName)
    .replace(/\s*\([^)]*\)\s*on Nostr$/i, '')
    .replace(/\s+on Nostr$/i, '')
    .trim()
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

      const metaTitle = pickMeta(html, [
        metaPattern('property', 'og:title'),
        metaPattern('name', 'twitter:title'),
        /<title[^>]*>([^<]+)<\/title>/i
      ])

      const title = pickArticleHeadline(html) || cleanTitle(metaTitle)
      const metaSummary = pickMeta(html, [
        metaPattern('property', 'og:description'),
        metaPattern('name', 'twitter:description'),
        metaPattern('name', 'description')
      ])
      const articleSummary = pickArticleBodySummary(html, title)
      const summary = articleSummary || clampSummary(stripHtml(metaSummary))

      const image = pickMeta(html, [
        metaPattern('property', 'og:image'),
        metaPattern('name', 'twitter:image')
      ])

      const metaAuthor = pickMeta(html, [
        metaPattern('property', 'article:author'),
        metaPattern('name', 'author')
      ])
      const siteName = pickMeta(html, [metaPattern('property', 'og:site_name')])
      const author = pickArticleAuthor(html, siteName) || stripHtml(metaAuthor)

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
