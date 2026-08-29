import type { ReadableContent } from './readerService'

const THREAD_ENDPOINT = 'https://api.fxtwitter.com/2/thread'

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function authorKey(status: JsonObject): string {
  const author = asObject(status.author)
  return stringValue(author?.id) || stringValue(author?.screen_name)
}

function parentId(status: JsonObject): string {
  return stringValue(asObject(status.replying_to)?.status)
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
  let body: JsonObject
  try {
    const parsed: unknown = JSON.parse(payload)
    const object = asObject(parsed)
    if (!object) return null
    body = object
  } catch {
    return null
  }

  const focal = asObject(body.status)
  if (!focal) return null
  const focalAuthor = authorKey(focal)
  const focalStatusId = xStatusId(sourceUrl)
  if (!focalAuthor || !focalStatusId) return null

  const statuses = new Map<string, JsonObject>()
  const thread = Array.isArray(body.thread) ? body.thread : []
  for (const value of thread) {
    const status = asObject(value)
    const id = stringValue(status?.id)
    if (status && id) statuses.set(id, status)
  }
  const focalId = stringValue(focal.id)
  if (focalId && !statuses.has(focalId)) statuses.set(focalId, focal)

  const ownStatuses = [...statuses.values()].filter(status => authorKey(status) === focalAuthor)
  if (ownStatuses.length === 0) return null

  const statusIds = new Set(ownStatuses.map(status => stringValue(status.id)))
  const roots = ownStatuses.filter(status => {
    const parent = parentId(status)
    return !parent || !statusIds.has(parent)
  })
  const pending: JsonObject[][] = (roots.length ? roots : [ownStatuses[0]]).map(root => [root])
  const completeChains: JsonObject[][] = []

  while (pending.length) {
    const path = pending.pop()!
    const currentId = stringValue(path[path.length - 1].id)
    const pathIds = new Set(path.map(status => stringValue(status.id)))
    const children = ownStatuses.filter(candidate =>
      !pathIds.has(stringValue(candidate.id)) && parentId(candidate) === currentId
    )
    if (children.length === 0) {
      completeChains.push(path)
    } else {
      for (const child of [...children].reverse()) pending.push([...path, child])
    }
  }

  const selected = completeChains
    .filter(chain => chain.some(status => stringValue(status.id) === focalStatusId))
    .sort((a, b) => b.length - a.length)[0]
  if (!selected) return null

  const markdown = selected
    .map(status => normalizeTweetText(stringValue(status.text)))
    .filter(Boolean)
    .join('\n\n')
  if (!markdown) return null

  const author = asObject(focal.author)
  const name = stringValue(author?.name)
  const screenName = stringValue(author?.screen_name)
  const authorLabel = screenName ? `@${screenName}` : ''
  const title = name && authorLabel
    ? `Thread by ${name} (${authorLabel})`
    : name || authorLabel
      ? `Thread by ${name || authorLabel}`
      : undefined

  return { title, url: sourceUrl, markdown }
}
