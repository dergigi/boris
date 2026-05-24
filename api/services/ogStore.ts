import { Redis } from '@upstash/redis'

// Support both KV_* and UPSTASH_* env var names
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN

const hasIncompleteRedisConfig = Boolean(
  (redisUrl && !redisToken) ||
  (!redisUrl && (redisToken || readOnlyToken))
)

if (hasIncompleteRedisConfig) {
  console.warn('Redis cache disabled due to incomplete Redis configuration')
}

const redisWrite = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

const redisRead = readOnlyToken && redisUrl
  ? new Redis({ url: redisUrl, token: readOnlyToken })
  : redisWrite

const keyOf = (naddr: string) => `og:${naddr}`

export type ArticleMetadata = {
  title: string
  summary: string
  image: string
  author: string
  published?: number
  tags?: string[]
  imageAlt?: string
}

export async function getArticleMeta(naddr: string): Promise<ArticleMetadata | null> {
  if (!redisRead) {
    return null
  }

  return (await redisRead.get<ArticleMetadata>(keyOf(naddr))) || null
}

export async function setArticleMeta(naddr: string, meta: ArticleMetadata, ttlSec = 604800): Promise<void> {
  if (!redisWrite) {
    return
  }

  await redisWrite.set(keyOf(naddr), meta, { ex: ttlSec })
}

