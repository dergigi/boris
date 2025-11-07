import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getArticleMeta, setArticleMeta } from './services/ogStore.js'
import { fetchArticleMetadataViaGateway } from './services/articleMeta.js'
import { generateHtml } from './services/ogHtml.js'

function setCacheHeaders(res: VercelResponse, maxAge: number = 86400): void {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=604800`)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const naddr = (req.query.naddr as string | undefined)?.trim()
  
  if (!naddr) {
    return res.status(400).json({ error: 'Missing naddr parameter' })
  }

  const debugEnabled = req.query.debug === '1' || req.headers['x-boris-debug'] === '1'
  if (debugEnabled) {
    res.setHeader('X-Boris-Debug', '1')
  }

  // Try Redis cache first
  let meta = await getArticleMeta(naddr).catch((err) => {
    console.error('Failed to get article meta from Redis:', err)
    return null
  })
  let cacheMaxAge = 86400

  if (!meta) {
    // Cache miss: try gateway (fast HTTP, no WebSockets)
    console.log(`Cache miss for ${naddr}, trying gateway...`)
    meta = await fetchArticleMetadataViaGateway(naddr)
    
    if (meta) {
      console.log(`Gateway found metadata for ${naddr}:`, { title: meta.title, summary: meta.summary?.substring(0, 50) })
      // Gateway found metadata: store it and use it
      await setArticleMeta(naddr, meta).catch((err) => {
        console.error('Failed to cache gateway metadata:', err)
      })
      cacheMaxAge = 86400
    } else {
      console.log(`Gateway failed for ${naddr}, using default fallback`)
      // Gateway failed: use default fallback
      cacheMaxAge = 300
    }
  } else {
    console.log(`Cache hit for ${naddr}:`, { title: meta.title, summary: meta.summary?.substring(0, 50) })
  }

  // Trigger background refresh on cache miss (fire-and-forget)
  if (!meta) {
    const secret = process.env.OG_REFRESH_SECRET || ''
    const origin = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : `https://read.withboris.com`
    
    fetch(`${origin}/api/article-og-refresh?naddr=${encodeURIComponent(naddr)}`, {
      method: 'POST',
      headers: { 'x-refresh-key': secret },
      keepalive: true
    }).catch(() => {
      // Ignore errors in background refresh trigger
    })
  }

  // Generate and send HTML
  const html = generateHtml(naddr, meta)
  setCacheHeaders(res, cacheMaxAge)
  
  if (debugEnabled) {
    // Debug mode enabled
  }
  
  return res.status(200).send(html)
}
