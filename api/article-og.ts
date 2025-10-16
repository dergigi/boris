import type { VercelRequest, VercelResponse } from '@vercel/node'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
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

interface ArticleMetadata {
  title: string
  summary: string
  image: string
  author: string
  published?: number
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

    // Fetch article (kind:30023)
    const articleFilter = {
      kinds: [pointer.kind],
      authors: [pointer.pubkey],
      '#d': [pointer.identifier || '']
    }

    const articleEvents: NostrEvent[] = []
    
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000)
      
      relayPool.req(relayUrls, articleFilter).subscribe({
        next: (msg) => {
          if (msg.type === 'EVENT') {
            articleEvents.push(msg.event)
          }
        },
        error: () => resolve(),
        complete: () => {
          clearTimeout(timeout)
          resolve()
        }
      })
    })

    if (articleEvents.length === 0) {
      relayPool.close()
      return null
    }

    // Sort by created_at and take most recent
    articleEvents.sort((a, b) => b.created_at - a.created_at)
    const article = articleEvents[0]

    // Fetch author profile (kind:0)
    const profileFilter = {
      kinds: [0],
      authors: [pointer.pubkey]
    }

    const profileEvents: NostrEvent[] = []
    
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 3000)
      
      relayPool.req(relayUrls, profileFilter).subscribe({
        next: (msg) => {
          if (msg.type === 'EVENT') {
            profileEvents.push(msg.event)
          }
        },
        error: () => resolve(),
        complete: () => {
          clearTimeout(timeout)
          resolve()
        }
      })
    })

    relayPool.close()

    // Extract article metadata
    const title = getArticleTitle(article) || 'Untitled Article'
    const summary = getArticleSummary(article) || 'Read this article on Boris'
    const image = getArticleImage(article) || '/boris-social-1200.png'

    // Extract author name from profile
    let authorName = pointer.pubkey.slice(0, 8) + '...'
    if (profileEvents.length > 0) {
      profileEvents.sort((a, b) => b.created_at - a.created_at)
      const profile = profileEvents[0]
      try {
        const profileData = JSON.parse(profile.content)
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
    relayPool.close()
    return null
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
    
    <!-- Default to system theme until settings load from Nostr -->
    <script>
      document.documentElement.className = 'theme-system';
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const naddr = (req.query.naddr as string | undefined)?.trim()
  
  if (!naddr) {
    return res.status(400).json({ error: 'Missing naddr parameter' })
  }

  // Check cache
  const cacheKey = naddr
  const now = Date.now()
  const cached = memoryCache.get(cacheKey)
  if (cached && cached.expires > now) {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(cached.html)
  }

  try {
    // Fetch metadata
    const meta = await fetchArticleMetadata(naddr)
    
    // Generate HTML
    const html = generateHtml(naddr, meta)
    
    // Cache the result
    memoryCache.set(cacheKey, { html, expires: now + WEEK_MS })
    
    // Send response
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (err) {
    console.error('Error generating article OG HTML:', err)
    
    // Fallback to basic HTML with SPA boot
    const html = generateHtml(naddr, null)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  }
}

