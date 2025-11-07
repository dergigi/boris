import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setArticleMeta } from './services/ogStore.js'
import { fetchArticleMetadataViaRelays } from './services/articleMeta.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Validate refresh secret
  const providedSecret = req.headers['x-refresh-key']
  const expectedSecret = process.env.OG_REFRESH_SECRET || ''
  
  if (providedSecret !== expectedSecret) {
    console.error('Background refresh unauthorized: secret mismatch')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const naddr = (req.query.naddr as string | undefined)?.trim()
  if (!naddr) {
    return res.status(400).json({ error: 'Missing naddr parameter' })
  }

  console.log(`Background refresh started for ${naddr}`)

  try {
    // Fetch metadata via relays (WebSockets) - no timeout, let it take as long as needed
    const meta = await fetchArticleMetadataViaRelays(naddr)
    
    if (meta) {
      console.log(`Background refresh found metadata for ${naddr}:`, { title: meta.title, summary: meta.summary?.substring(0, 50) })
      // Store in Redis
      await setArticleMeta(naddr, meta)
      console.log(`Background refresh cached metadata for ${naddr}`)
      return res.status(200).json({ ok: true, cached: true })
    } else {
      console.log(`Background refresh found no metadata for ${naddr}`)
      return res.status(200).json({ ok: true, cached: false })
    }
  } catch (err) {
    console.error(`Error refreshing article metadata for ${naddr}:`, err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

