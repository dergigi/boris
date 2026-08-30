import type { ReadableContent } from './readerService'

const THREAD_ENDPOINT = 'https://api.fxtwitter.com/2/thread'

interface FxAuthor {
  id?: string
  screenName?: string
  name?: string
}

interface FxArticle {
  title?: string
  blocks: string[]
}

interface FxStatus {
  id: string
  text: string
  author: FxAuthor
  parentId: string
  article?: FxArticle
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseArticle(value: unknown): FxArticle | undefined {
  const article = asObject(value)
  const content = asObject(article?.content)
  const blocks = Array.isArray(content?.blocks)
    ? content.blocks
      .map(block => stringValue(asObject(block)?.text))
      .filter(Boolean)
    : []
  const title = stringValue(article?.title)
  return blocks.length ? { title: title || undefined, blocks } : undefined
}

function parseStatus(value: unknown): FxStatus | null {
  const object = asObject(value)
  const authorObject = asObject(object?.author)
  const author: FxAuthor = {
    id: stringValue(authorObject?.id) || undefined,
    screenName: stringValue(authorObject?.screen_name) || undefined,
    name: stringValue(authorObject?.name) || undefined
  }
  if (!object || !author.id && !author.screenName) return null

  const id = stringValue(object.id)
  if (!id) return null
  return {
    id,
    text: stringValue(object.text),
    author,
    parentId: stringValue(asObject(object.replying_to)?.status),
    article: parseArticle(object.article)
  }
}

function authorKey(status: FxStatus): string {
  return status.author.id || status.author.screenName || ''
}

function normalizeTweetText(text: string): string {
  return text
    .replace(/[\u2028\u2029]/g, '\n')
    .split('\n')
    .map(line => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function xStatusId(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return null
    return url.pathname.match(/^\/[^/]+\/status\/(\d+)/i)?.[1] || null
  } catch {
    return null
  }
}

export async function fetchXThreadContent(
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReadableContent | null> {
  const statusId = xStatusId(sourceUrl)
  if (!statusId) return null

  const response = await fetchImpl(`${THREAD_ENDPOINT}/${statusId}`, {
    headers: { accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`Failed to fetch X thread (${response.status})`)
  return parseFxTwitterThreadPayload(await response.text(), sourceUrl)
}

export function parseFxTwitterThreadPayload(
  payload: string,
  sourceUrl: string
): ReadableContent | null {
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(payload)
    const object = asObject(parsed)
    if (!object) return null
    body = object
  } catch {
    return null
  }

  const focal = parseStatus(body.status)
  if (!focal) return null
  const focalAuthor = authorKey(focal)
  const focalStatusId = xStatusId(sourceUrl)
  if (!focalAuthor || !focalStatusId) return null

  const article = focal.article
  const articleMarkdown = article?.blocks.map(normalizeTweetText).filter(Boolean).join('\n\n')
  if (articleMarkdown) {
    return {
      title: article?.title || threadTitle(focal.author),
      url: sourceUrl,
      markdown: articleMarkdown
    }
  }

  const statuses = new Map<string, FxStatus>()
  const thread = Array.isArray(body.thread) ? body.thread : []
  for (const value of thread) {
    const status = parseStatus(value)
    const id = status?.id || ''
    if (status && id) statuses.set(id, status)
  }
  const focalId = stringValue(focal.id)
  if (focalId && !statuses.has(focalId)) statuses.set(focalId, focal)

  const ownStatuses = [...statuses.values()].filter(status => authorKey(status) === focalAuthor)
  if (ownStatuses.length === 0) return null

  const statusIds = new Set(ownStatuses.map(status => status.id))
  const roots = ownStatuses.filter(status => {
    const parent = status.parentId
    return !parent || !statusIds.has(parent)
  })
  const pending: FxStatus[][] = (roots.length ? roots : [ownStatuses[0]]).map(root => [root])
  const completeChains: FxStatus[][] = []

  while (pending.length) {
    const path = pending.pop()!
    const currentId = path[path.length - 1].id
    const pathIds = new Set(path.map(status => status.id))
    const children = ownStatuses.filter(candidate =>
      !pathIds.has(candidate.id) && candidate.parentId === currentId
    )
    if (children.length === 0) {
      completeChains.push(path)
    } else {
      for (const child of [...children].reverse()) pending.push([...path, child])
    }
  }

  const selected = completeChains
    .filter(chain => chain.some(status => status.id === focalStatusId))
    .sort((a, b) => b.length - a.length)[0]
  if (!selected) return null

  const markdown = selected
    .map(status => normalizeTweetText(status.text))
    .filter(Boolean)
    .join('\n\n')
  if (!markdown) return null

  const title = threadTitle(focal.author)
  return { title, url: sourceUrl, markdown }
}

function threadTitle(author: FxAuthor): string | undefined {
  const authorLabel = author.screenName ? `@${author.screenName}` : ''
  return author.name && authorLabel
    ? `Thread by ${author.name} (${authorLabel})`
    : author.name || authorLabel
      ? `Thread by ${author.name || authorLabel}`
      : undefined
}
