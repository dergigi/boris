import type { VercelRequest, VercelResponse } from '@vercel/node'

type CacheEntry = {
  body: unknown
  expires: number
}

type VimeoOEmbedResponse = {
  title: string
  description: string
  author_name: string
  author_url: string
  provider_name: string
  provider_url: string
  type: string
  version: string
  width: number
  height: number
  html: string
  thumbnail_url: string
  thumbnail_width: number
  thumbnail_height: number
}

// In-memory cache for 7 days
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const memoryCache = new Map<string, CacheEntry>()

function buildKey(videoId: string) {
  return `vimeo|${videoId}`
}

function ok(res: VercelResponse, data: unknown) {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800') // client: 1d, CDN: 7d
  return res.status(200).json(data)
}

function bad(res: VercelResponse, code: number, message: string) {
  return res.status(code).json({ error: message })
}

async function getVimeoMetadata(videoId: string): Promise<{ title: string; description: string }> {
  const vimeoUrl = `https://vimeo.com/${videoId}`
  const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}`
  
  const response = await fetch(oembedUrl)
  if (!response.ok) {
    throw new Error(`Vimeo oEmbed API returned ${response.status}`)
  }
  
  const data: VimeoOEmbedResponse = await response.json()
  
  return {
    title: data.title || '',
    description: data.description || ''
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const videoId = (req.query.videoId as string | undefined)?.trim()
  if (!videoId) return bad(res, 400, 'Missing videoId')

  // Validate that videoId is a number
  if (!/^\d+$/.test(videoId)) {
    return bad(res, 400, 'Invalid Vimeo video ID - must be numeric')
  }

  const cacheKey = buildKey(videoId)
  const now = Date.now()
  const cached = memoryCache.get(cacheKey)
  if (cached && cached.expires > now) {
    return ok(res, cached.body)
  }

  try {
    const { title, description } = await getVimeoMetadata(videoId)
    
    const response = {
      title,
      description,
      captions: [], // Vimeo doesn't provide captions through oEmbed API
      transcript: '', // No transcript available
      lang: 'en', // Default language
      isAuto: false, // Not applicable for Vimeo
      source: 'vimeo'
    }

    memoryCache.set(cacheKey, { body: response, expires: now + WEEK_MS })
    return ok(res, response)
  } catch (e) {
    return bad(res, 500, 'Failed to fetch Vimeo metadata')
  }
}
