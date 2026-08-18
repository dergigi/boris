import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchArticleMetadata } from './services/articleMeta.js'
import { generateHtml } from './services/ogHtml.js'

function setCacheHeaders(
  res: VercelResponse,
  maxAge: number = 86400,
  sharedMaxAge: number = 604800
): void {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sharedMaxAge}`)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let naddr = ''

  try {
    const rawNaddr = Array.isArray(req.query.naddr)
      ? req.query.naddr[0]
      : req.query.naddr
    naddr = typeof rawNaddr === 'string' ? rawNaddr.trim() : ''

    if (!naddr) {
      return res.status(400).json({ error: 'Missing naddr parameter' })
    }

    const debugEnabled = req.query.debug === '1' || req.headers['x-boris-debug'] === '1'
    if (debugEnabled) {
      res.setHeader('X-Boris-Debug', '1')
    }

    const meta = await fetchArticleMetadata(naddr)
    const cacheMaxAge = meta ? 86400 : 60

    const html = generateHtml(naddr, meta)
    const sharedCacheMaxAge = meta ? 604800 : cacheMaxAge
    setCacheHeaders(res, cacheMaxAge, sharedCacheMaxAge)
    return res.status(200).send(html)
  } catch (err) {
    console.error('Unhandled error in article-og handler:', err)
    const fallbackHtml = generateHtml(
      naddr || '',
      null
    )
    setCacheHeaders(res, 60, 60)
    return res.status(200).send(fallbackHtml)
  }
}
