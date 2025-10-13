import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSubtitles, getVideoDetails } from '@treeee/youtube-caption-extractor'

type Caption = { start: number; dur: number; text: string }

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

function buildKey(videoId: string, lang: string, preferAuto?: string | string[], source?: string) {
  return `${source || 'video'}|${videoId}|${lang}|${preferAuto ? 'auto' : 'manual'}`
}

function ok(res: VercelResponse, data: unknown) {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800') // client: 1d, CDN: 7d
  return res.status(200).json(data)
}

function bad(res: VercelResponse, code: number, message: string) {
  return res.status(code).json({ error: message })
}

function extractVideoId(url: string): { id: string; source: 'youtube' | 'vimeo' } | null {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ]
  
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern)
    if (match) {
      return { id: match[1], source: 'youtube' }
    }
  }
  
  // Vimeo patterns
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ]
  
  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern)
    if (match) {
      return { id: match[1], source: 'vimeo' }
    }
  }
  
  return null
}

async function pickCaptions(videoID: string, preferredLangs: string[], manualFirst: boolean): Promise<{ caps: Caption[]; lang: string; isAuto: boolean } | null> {
  for (const lang of preferredLangs) {
    try {
      const caps = await getSubtitles({ videoID, lang, auto: !manualFirst ? true : false })
      if (Array.isArray(caps) && caps.length > 0) {
        return { caps, lang, isAuto: !manualFirst }
      }
    } catch {
      // try next
    }
  }
  return null
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
  const url = (req.query.url as string | undefined)?.trim()
  const videoId = (req.query.videoId as string | undefined)?.trim()
  
  if (!url && !videoId) {
    return bad(res, 400, 'Missing url or videoId parameter')
  }

  // Extract video info from URL or use provided videoId
  let videoInfo: { id: string; source: 'youtube' | 'vimeo' }
  
  if (url) {
    const extracted = extractVideoId(url)
    if (!extracted) {
      return bad(res, 400, 'Unsupported video URL. Only YouTube and Vimeo are supported.')
    }
    videoInfo = extracted
  } else {
    // If only videoId is provided, assume YouTube for backward compatibility
    videoInfo = { id: videoId!, source: 'youtube' }
  }

  const lang = ((req.query.lang as string | undefined) || 'en').toLowerCase()
  const uiLocale = (req.headers['x-ui-locale'] as string | undefined)?.toLowerCase()
  const preferAuto = req.query.preferAuto === 'true'

  const cacheKey = buildKey(videoInfo.id, lang, preferAuto ? 'auto' : undefined, videoInfo.source)
  const now = Date.now()
  const cached = memoryCache.get(cacheKey)
  if (cached && cached.expires > now) {
    return ok(res, cached.body)
  }

  try {
    if (videoInfo.source === 'youtube') {
      // YouTube handling
      const details: unknown = await getVideoDetails({ videoID: videoInfo.id, lang })
      // Be tolerant to possible shapes returned by the extractor
      const title = (details as { title?: string } | undefined)?.title || ''
      const d1 = (details as { description?: string } | undefined)?.description
      const d2 = (details as { shortDescription?: string } | undefined)?.shortDescription
      const d3 = (details as { descriptionText?: string } | undefined)?.descriptionText
      const description = d1 || d2 || d3 || ''

      // Language order: manual en -> uiLocale -> lang -> any manual, then auto with same order
      const langs: string[] = Array.from(new Set(['en', uiLocale, lang].filter(Boolean) as string[]))

      let selected = null as null | { caps: Caption[]; lang: string; isAuto: boolean }
      // Manual first
      selected = await pickCaptions(videoInfo.id, langs, true)
      if (!selected) {
        // Try auto
        selected = await pickCaptions(videoInfo.id, langs, false)
      }

      const captions = selected?.caps || []
      const transcript = captions.map(c => c.text).join(' ').trim()
      const response = {
        title,
        description,
        captions,
        transcript,
        lang: selected?.lang || lang,
        isAuto: selected?.isAuto || false,
        source: 'youtube'
      }

      memoryCache.set(cacheKey, { body: response, expires: now + WEEK_MS })
      return ok(res, response)
    } else if (videoInfo.source === 'vimeo') {
      // Vimeo handling
      const { title, description } = await getVimeoMetadata(videoInfo.id)
      
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
    } else {
      return bad(res, 400, 'Unsupported video source')
    }
  } catch (e) {
    return bad(res, 500, `Failed to fetch ${videoInfo.source} metadata`)
  }
}
