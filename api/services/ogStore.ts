import { Redis } from '@upstash/redis'

const redisWrite = Redis.fromEnv()
const redisRead = process.env.KV_REST_API_READ_ONLY_TOKEN && process.env.KV_REST_API_URL
  ? new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_READ_ONLY_TOKEN! })
  : redisWrite

const keyOf = (naddr: string) => `og:${naddr}`

export type ArticleMetadata = {
  title: string
  summary: string
  image: string
  author: string
  published?: number
}

export async function getArticleMeta(naddr: string): Promise<ArticleMetadata | null> {
  return (await redisRead.get<ArticleMetadata>(keyOf(naddr))) || null
}

export async function setArticleMeta(naddr: string, meta: ArticleMetadata, ttlSec = 604800): Promise<void> {
  await redisWrite.set(keyOf(naddr), meta, { ex: ttlSec })
}

