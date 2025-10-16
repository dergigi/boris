import type { VercelRequest, VercelResponse } from '@vercel/node'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent, Filter } from 'nostr-tools'
import { Helpers } from 'applesauce-core'

const { getArticleTitle, getArticleImage, getArticleSummary } = Helpers

// Relay configuration (from src/config/relays.ts)
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.dergigi.com',
  'wss://wot.dergigi.com',
  'wss://relay.snort.social',
  'wss://relay.current.fyi',
  'wss://nostr-pub.wellorder.net',
  'wss://purplepag.es',
  'wss://relay.primal.net'
]

type CacheEntry = {
  html: string
  expires: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const memoryCache = new Map<string, CacheEntry>()

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function setCacheHeaders(res: VercelResponse, maxAge: number = 86400): void {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=604800`)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
}

interface ArticleMetadata {
  title: string
  summary: string
  image: string
  author: string
  published?: number
}

async function fetchEventsFromRelays(
  relayPool: RelayPool,
  relayUrls: string[],
  filter: Filter,
  timeoutMs: number
): Promise<NostrEvent[]> {
  const events: NostrEvent[] = []
  
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), timeoutMs)
    
    relayPool.req(relayUrls, filter).subscribe({
      next: (msg) => {
        if (msg.type === 'EVENT') {
          events.push(msg.event)
        }
      },
      error: () => resolve(),
      complete: () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  // Sort by created_at and return most recent first
  return events.sort((a, b) => b.created_at - a.created_at)
}

async function fetchArticleMetadata(naddr: string): Promise<ArticleMetadata | null> {
  const relayPool = new RelayPool()
  
  try {
    // Decode naddr
    const decoded = nip19.decode(naddr)
    if (decoded.type !== 'naddr') {
      return null
    }

    const pointer = decoded.data as AddressPointer

    // Connect to relays
    const relayUrls = pointer.relays && pointer.relays.length > 0 ? pointer.relays : RELAYS
    relayUrls.forEach(url => relayPool.open(url))

    // Fetch article and profile in parallel
    const [articleEvents, profileEvents] = await Promise.all([
      fetchEventsFromRelays(relayPool, relayUrls, {
        kinds: [pointer.kind],
        authors: [pointer.pubkey],
        '#d': [pointer.identifier || '']
      }, 5000),
      fetchEventsFromRelays(relayPool, relayUrls, {
        kinds: [0],
        authors: [pointer.pubkey]
      }, 3000)
    ])

    if (articleEvents.length === 0) {
      return null
    }

    const article = articleEvents[0]

    // Extract article metadata
    const title = getArticleTitle(article) || 'Untitled Article'
    const summary = getArticleSummary(article) || 'Read this article on Boris'
    const image = getArticleImage(article) || '/boris-social-1200.png'

    // Extract author name from profile
    let authorName = pointer.pubkey.slice(0, 8) + '...'
    if (profileEvents.length > 0) {
      try {
        const profileData = JSON.parse(profileEvents[0].content)
        authorName = profileData.display_name || profileData.name || authorName
      } catch {
        // Use fallback
      }
    }

    return {
      title,
      summary,
      image,
      author: authorName,
      published: article.created_at
    }
  } catch (err) {
    console.error('Failed to fetch article metadata:', err)
    return null
  } finally {
    relayPool.close()
  }
}

function generateHtml(naddr: string, meta: ArticleMetadata | null): string {
  const baseUrl = 'https://read.withboris.com'
  const articleUrl = `${baseUrl}/a/${naddr}`
  
  const title = meta?.title || 'Boris – Nostr Bookmarks'
  const description = meta?.summary || 'Your reading list for the Nostr world. A minimal nostr client for bookmark management with highlights.'
  const image = meta?.image?.startsWith('http') ? meta.image : `${baseUrl}${meta?.image || '/boris-social-1200.png'}`
  const author = meta?.author || 'Boris'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${articleUrl}" />
    
    <!-- Open Graph / Social Media -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${articleUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:site_name" content="Boris" />
    ${meta?.published ? `<meta property="article:published_time" content="${new Date(meta.published * 1000).toISOString()}" />` : ''}
    <meta property="article:author" content="${escapeHtml(author)}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${articleUrl}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
  </head>
  <body>
    <noscript>
      <p>Redirecting to <a href="/">Boris</a>...</p>
    </noscript>
  </body>
</html>`
}

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  const crawlers = [
    'bot', 'crawl', 'spider', 'slurp', 'facebook', 'twitter', 'linkedin',
    'whatsapp', 'telegram', 'slack', 'discord', 'preview'
  ]
  const ua = userAgent.toLowerCase()
  return crawlers.some(crawler => ua.includes(crawler))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const naddr = (req.query.naddr as string | undefined)?.trim()
  
  if (!naddr) {
    return res.status(400).json({ error: 'Missing naddr parameter' })
  }

  const userAgent = req.headers['user-agent'] as string | undefined

  // If it's a regular browser (not a bot), serve index.html with base tag
  // The rewrite preserves the URL, so SPA routing will handle /a/{naddr}
  if (!isCrawler(userAgent)) {
    const fs = await import('fs')
    const path = await import('path')
    // eslint-disable-next-line no-undef
    const indexPath = path.join(process.cwd(), 'dist', 'index.html')
    
    try {
      let indexHtml = fs.readFileSync(indexPath, 'utf-8')
      // Add base tag to ensure assets load from root
      indexHtml = indexHtml.replace('<head>', '<head>\n    <base href="/" />')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
      return res.status(200).send(indexHtml)
    } catch (err) {
      // Fallback if dist/index.html doesn't exist (dev mode)
      res.setHeader('Location', '/')
      return res.status(302).send('')
    }
  }

  // Check cache for bots/crawlers
  const now = Date.now()
  const cached = memoryCache.get(naddr)
  if (cached && cached.expires > now) {
    setCacheHeaders(res)
    return res.status(200).send(cached.html)
  }

  try {
    // Fetch metadata
    const meta = await fetchArticleMetadata(naddr)
    
    // Generate HTML
    const html = generateHtml(naddr, meta)
    
    // Cache the result
    memoryCache.set(naddr, { html, expires: now + WEEK_MS })
    
    // Send response
    setCacheHeaders(res)
    return res.status(200).send(html)
  } catch (err) {
    console.error('Error generating article OG HTML:', err)
    
    // Fallback to basic HTML with SPA boot
    const html = generateHtml(naddr, null)
    setCacheHeaders(res, 3600)
    return res.status(200).send(html)
  }
}

