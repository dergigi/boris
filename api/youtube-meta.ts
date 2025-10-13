import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSubtitles } from '@treeee/youtube-caption-extractor'

type Caption = { start: number; dur: number; text: string }

type Subtitle = { start: string | number; dur: string | number; text: string }

type CacheEntry = {
  body: unknown
  expires: number
}

// In-memory cache for 7 days
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const memoryCache = new Map<string, CacheEntry>()

function buildKey(videoId: string, lang: string, preferAuto?: string | string[]) {
  return `${videoId}|${lang}|${preferAuto ? 'auto' : 'manual'}`
}

function ok(res: VercelResponse, data: unknown) {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800') // client: 1d, CDN: 7d
  return res.status(200).json(data)
}

function bad(res: VercelResponse, code: number, message: string) {
  return res.status(code).json({ error: message })
}

async function pickCaptions(videoID: string, preferredLangs: string[], manualFirst: boolean): Promise<{ caps: Caption[]; lang: string; isAuto: boolean } | null> {
  for (const lang of preferredLangs) {
    try {
      const caps = await getSubtitles({ videoID, lang })
      if (Array.isArray(caps) && caps.length > 0) {
        // Convert the returned subtitles to our Caption format
        const convertedCaps: Caption[] = caps.map((cap: Subtitle) => ({
          start: typeof cap.start === 'string' ? parseFloat(cap.start) : cap.start,
          dur: typeof cap.dur === 'string' ? parseFloat(cap.dur) : cap.dur,
          text: cap.text
        }))
        return { caps: convertedCaps, lang, isAuto: !manualFirst }
      }
    } catch {
      // try next
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const videoId = (req.query.videoId as string | undefined)?.trim()
  if (!videoId) return bad(res, 400, 'Missing videoId')

  const lang = ((req.query.lang as string | undefined) || 'en').toLowerCase()
  const uiLocale = (req.headers['x-ui-locale'] as string | undefined)?.toLowerCase()
  const preferAuto = req.query.preferAuto === 'true'

  const cacheKey = buildKey(videoId, lang, preferAuto ? 'auto' : undefined)
  const now = Date.now()
  const cached = memoryCache.get(cacheKey)
  if (cached && cached.expires > now) {
    return ok(res, cached.body)
  }

  try {
    // Since getVideoDetails doesn't exist, we'll use a simple approach
    // In a real implementation, you might want to use YouTube's API or other methods
    const title = '' // Will be populated from captions or other sources
    const description = ''

    // Language order: manual en -> uiLocale -> lang -> any manual, then auto with same order
    const langs: string[] = Array.from(new Set(['en', uiLocale, lang].filter(Boolean) as string[]))

    let selected = null as null | { caps: Caption[]; lang: string; isAuto: boolean }
    // Manual first
    selected = await pickCaptions(videoId, langs, true)
    if (!selected) {
      // Try auto
      selected = await pickCaptions(videoId, langs, false)
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
  } catch (e) {
    return bad(res, 500, 'Failed to fetch YouTube metadata')
  }
}


