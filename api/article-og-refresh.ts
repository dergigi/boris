import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setArticleMeta } from '../src/services/ogStore'
import { fetchArticleMetadataViaRelays } from '../src/services/articleMeta'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Validate refresh secret
  const providedSecret = req.headers['x-refresh-key']
  const expectedSecret = process.env.OG_REFRESH_SECRET || ''
  
  if (providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const naddr = (req.query.naddr as string | undefined)?.trim()
  if (!naddr) {
    return res.status(400).json({ error: 'Missing naddr parameter' })
  }

  try {
    // Fetch metadata via relays (WebSockets)
    const meta = await fetchArticleMetadataViaRelays(naddr)
    
    if (meta) {
      // Store in Redis
      await setArticleMeta(naddr, meta)
      return res.status(200).json({ ok: true, cached: true })
    } else {
      return res.status(200).json({ ok: true, cached: false })
    }
  } catch (err) {
    console.error('Error refreshing article metadata:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

