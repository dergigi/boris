export type Caption = { start: number; dur: number; text: string }
export type YouTubeMeta = {
  title: string
  description?: string
  captions: Caption[]
  transcript?: string
  lang: string
  isAuto?: boolean
  source: 'youtube'
}

type CachedMeta = {
  data: YouTubeMeta
  timestamp: number
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function cacheKey(videoId: string, lang: string) {
  return `yt_meta_${videoId}_${lang}`
}

function load(videoId: string, lang: string): YouTubeMeta | null {
  try {
    const raw = localStorage.getItem(cacheKey(videoId, lang))
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw) as CachedMeta
    if (Date.now() - timestamp > TTL_MS) {
      localStorage.removeItem(cacheKey(videoId, lang))
      return null
    }
    return data
  } catch {
    return null
  }
}

function save(videoId: string, lang: string, data: YouTubeMeta) {
  try {
    const value: CachedMeta = { data, timestamp: Date.now() }
    localStorage.setItem(cacheKey(videoId, lang), JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1)
    }
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const parts = u.pathname.split('/').filter(Boolean)
    // /shorts/:id or /embed/:id
    if ((parts[0] === 'shorts' || parts[0] === 'embed') && parts[1]) return parts[1]
    return null
  } catch {
    return null
  }
}

export async function getYouTubeMeta(videoId: string, lang = 'en'): Promise<YouTubeMeta | null> {
  const cached = load(videoId, lang)
  if (cached) return cached
  const res = await fetch(`/api/youtube-meta?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`, {
    headers: {
      'x-ui-locale': lang
    }
  })
  if (!res.ok) return null
  const data = (await res.json()) as YouTubeMeta
  save(videoId, lang, data)
  return data
}


