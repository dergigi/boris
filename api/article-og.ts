import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getArticleMeta, setArticleMeta } from './services/ogStore.js'
import { fetchArticleMetadataViaRelays } from './services/articleMeta.js'
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
    // Cache miss: fetch from relays (let it use its natural timeouts)
    console.log(`Cache miss for ${naddr}, fetching from relays...`)
    
    try {
      meta = await fetchArticleMetadataViaRelays(naddr)
      
      if (meta) {
        console.log(`Relays found metadata for ${naddr}:`, { title: meta.title, summary: meta.summary?.substring(0, 50) })
        // Store in Redis and use it
        await setArticleMeta(naddr, meta).catch((err) => {
          console.error('Failed to cache relay metadata:', err)
        })
        cacheMaxAge = 86400
      } else {
        console.log(`Relay fetch failed for ${naddr}, using default fallback`)
        // Relay fetch failed: use default fallback
        cacheMaxAge = 300
      }
    } catch (err) {
      console.error(`Error fetching from relays for ${naddr}:`, err)
      cacheMaxAge = 300
    }
  } else {
    console.log(`Cache hit for ${naddr}:`, { title: meta.title, summary: meta.summary?.substring(0, 50) })
  }

  // Generate and send HTML
  const html = generateHtml(naddr, meta)
  setCacheHeaders(res, cacheMaxAge)
  
  if (debugEnabled) {
    // Debug mode enabled
  }
  
  return res.status(200).send(html)
}
