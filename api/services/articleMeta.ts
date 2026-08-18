import type { ArticleMetadata } from './articleMetadata.js'

const DEFAULT_TITLE = 'Read on Boris'
const DEFAULT_SUMMARY = 'Read this article on Boris'
const DEFAULT_IMAGE = '/boris-social-1200.png'
const DEFAULT_AUTHOR = 'Boris'
const SUMMARY_MAX_LENGTH = 220
const GATEWAY_REQUEST_TIMEOUT_MS = 4500
const GATEWAY_BASE_URLS = [
  'https://njump.me',
  'https://nostr.com',
  'https://nostr.at',
  'https://nostr.eu',
  'https://nostr.ae'
] as const

class NoMetadataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoMetadataError'
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function metaPattern(attribute: 'name' | 'property', value: string): RegExp {
  return new RegExp(
    `<meta(?=[^>]*\\b${attribute}=["']${escapeRegExp(value)}["'])(?=[^>]*\\bcontent=(["'])(?<content>[\\s\\S]*?)\\1)[^>]*>`,
    'i'
  )
}

function pickMeta(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    const value = match?.groups?.content || match?.[1]
    if (value) {
      return value.trim()
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
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity
    }

    return namedEntities[normalized] || entity
  })
}

function isValidCodePoint(codePoint: number): boolean {
  return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
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

function pickNameInMarkup(markup: string): string {
  const name = markup.match(/<span(?=[^>]*\bitemprop=["']name["'])[^>]*>([\s\S]*?)<\/span>/i)
  if (name?.[1]) {
    return stripHtml(name[1])
  }

  const alternateName = markup.match(/<span(?=[^>]*\bitemprop=["']alternateName["'])[^>]*>([\s\S]*?)<\/span>/i)
  if (alternateName?.[1]) {
    return stripHtml(alternateName[1])
  }

  return ''
}

function cleanSiteName(siteName: string): string {
  return stripHtml(siteName)
    .replace(/\s*\([^)]*\)\s*on Nostr$/i, '')
    .replace(/\s+on Nostr$/i, '')
    .trim()
}

function pickArticleAuthor(html: string, siteName: string, metaAuthor: string): string {
  const authorHeader = html.match(/<header(?=[^>]*\bitemprop=["']author["'])[^>]*>([\s\S]*?)<\/header>/i)?.[1]
  const authorName = authorHeader ? pickNameInMarkup(authorHeader) : ''
  if (authorName) {
    return authorName
  }

  const relAuthor = html.match(/<a(?=[^>]*\brel=["']author["'])[^>]*>([\s\S]*?)<\/a>/i)?.[1]
  const relAuthorName = relAuthor ? pickNameInMarkup(relAuthor) || stripHtml(relAuthor) : ''
  if (relAuthorName) {
    return relAuthorName
  }

  const authorFromMeta = stripHtml(metaAuthor)
  if (authorFromMeta) {
    return authorFromMeta
  }

  const authorFromSiteName = cleanSiteName(siteName)
  if (authorFromSiteName) {
    return authorFromSiteName
  }

  return pickNameInMarkup(html)
}

function extractArticleMetadata(html: string): ArticleMetadata | null {
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
  const author = pickArticleAuthor(html, siteName, metaAuthor)

  if (!title && !summary && !image) {
    return null
  }

  return {
    title: title || DEFAULT_TITLE,
    summary: summary || DEFAULT_SUMMARY,
    image: image || DEFAULT_IMAGE,
    author: author || DEFAULT_AUTHOR
  }
}

async function fetchGatewayHtml(gatewayBaseUrl: string, naddr: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GATEWAY_REQUEST_TIMEOUT_MS)

  try {
    const url = `${gatewayBaseUrl}/${encodeURIComponent(naddr)}`
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Boris OG fetcher'
      }
    })

    if (!resp.ok) {
      throw new Error(`Gateway fetch failed: ${resp.status} ${resp.statusText} for ${url}`)
    }

    return await resp.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchArticleMetadataFromGateway(gatewayBaseUrl: string, naddr: string): Promise<ArticleMetadata> {
  const html = await fetchGatewayHtml(gatewayBaseUrl, naddr)
  const metadata = extractArticleMetadata(html)

  if (!metadata) {
    throw new NoMetadataError(`No OG metadata found via ${gatewayBaseUrl} for ${naddr}`)
  }

  return metadata
}

function isNoMetadataError(error: unknown): boolean {
  return error instanceof NoMetadataError
}

export async function fetchArticleMetadata(naddr: string): Promise<ArticleMetadata | null> {
  try {
    return await Promise.any(
      GATEWAY_BASE_URLS.map((gatewayBaseUrl) => fetchArticleMetadataFromGateway(gatewayBaseUrl, naddr))
    )
  } catch (err) {
    if (err instanceof AggregateError && err.errors.length > 0 && err.errors.every(isNoMetadataError)) {
      console.log(`No OG metadata found across gateways for ${naddr}`)
      return null
    }

    console.error('Failed to fetch article metadata via gateways:', err)
    throw err
  }
}
