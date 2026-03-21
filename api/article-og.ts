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

  try {
    if (!naddr) {
      return res.status(400).json({ error: 'Missing naddr parameter' })
    }

    const debugEnabled = req.query.debug === '1' || req.headers['x-boris-debug'] === '1'
    if (debugEnabled) {
      res.setHeader('X-Boris-Debug', '1')
    }

    let meta = await getArticleMeta(naddr).catch((err) => {
      console.error('Failed to get article meta from Redis:', err)
      return null
    })
    let cacheMaxAge = 86400

    if (!meta) {
      try {
        meta = await fetchArticleMetadataViaRelays(naddr)

        if (meta) {
          await setArticleMeta(naddr, meta).catch((err) => {
            console.error('Failed to cache relay metadata:', err)
          })
        } else {
          cacheMaxAge = 300
        }
      } catch (err) {
        console.error(`Error fetching from relays for ${naddr}:`, err)
        cacheMaxAge = 300
      }
    }

    const html = generateHtml(naddr, meta)
    setCacheHeaders(res, cacheMaxAge)
    return res.status(200).send(html)
  } catch (err) {
    console.error('Unhandled error in article-og handler:', err)
    const fallbackHtml = generateHtml(
      naddr || '',
      null
    )
    setCacheHeaders(res, 60)
    return res.status(200).send(fallbackHtml)
  }
}
