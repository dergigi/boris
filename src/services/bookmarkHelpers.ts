import { getParsedContent } from 'applesauce-content/text'
import { ActiveAccount, IndividualBookmark, ParsedContent } from '../types/bookmarks'
import type { NostrEvent } from './bookmarkEvents'

// Global symbol for caching hidden bookmark content on events
export const BookmarkHiddenSymbol = Symbol.for('bookmark-hidden')

export interface BookmarkData {
  id?: string
  content?: string
  created_at?: number
  kind?: number
  tags?: string[][]
}

export interface ApplesauceBookmarks {
  notes?: BookmarkData[]
  articles?: BookmarkData[]
  hashtags?: BookmarkData[]
  urls?: BookmarkData[]
}

export interface AccountWithExtension {
  pubkey: string
  signer?: unknown
  nip04?: unknown
  nip44?: unknown
  [key: string]: unknown
}

export function isAccountWithExtension(account: unknown): account is AccountWithExtension {
  return (
    typeof account === 'object' &&
    account !== null &&
    'pubkey' in account &&
    typeof (account as { pubkey?: unknown }).pubkey === 'string'
  )
}

export function isHexId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{64}$/i.test(id)
}
export type { NostrEvent } from './bookmarkEvents'
export { dedupeNip51Events } from './bookmarkEvents'

export const processApplesauceBookmarks = (
  bookmarks: unknown,
  activeAccount: ActiveAccount,
  isPrivate: boolean
): IndividualBookmark[] => {
  if (!bookmarks) return []

  if (typeof bookmarks === 'object' && bookmarks !== null && !Array.isArray(bookmarks)) {
    const applesauceBookmarks = bookmarks as ApplesauceBookmarks
    const allItems: BookmarkData[] = []
    if (applesauceBookmarks.notes) allItems.push(...applesauceBookmarks.notes)
    if (applesauceBookmarks.articles) allItems.push(...applesauceBookmarks.articles)
    if (applesauceBookmarks.hashtags) allItems.push(...applesauceBookmarks.hashtags)
    if (applesauceBookmarks.urls) allItems.push(...applesauceBookmarks.urls)
    return allItems.map((bookmark: BookmarkData) => ({
      id: bookmark.id || `${isPrivate ? 'private' : 'public'}-${Date.now()}`,
      content: bookmark.content || '',
      created_at: bookmark.created_at || Math.floor(Date.now() / 1000),
      pubkey: activeAccount.pubkey,
      kind: bookmark.kind || 30001,
      tags: bookmark.tags || [],
      parsedContent: bookmark.content ? (getParsedContent(bookmark.content) as ParsedContent) : undefined,
      type: 'event' as const,
      isPrivate
    }))
  }

  const bookmarkArray = Array.isArray(bookmarks) ? bookmarks : [bookmarks]
  return bookmarkArray.map((bookmark: BookmarkData) => ({
    id: bookmark.id || `${isPrivate ? 'private' : 'public'}-${Date.now()}`,
    content: bookmark.content || '',
    created_at: bookmark.created_at || Math.floor(Date.now() / 1000),
    pubkey: activeAccount.pubkey,
    kind: bookmark.kind || 30001,
    tags: bookmark.tags || [],
    parsedContent: bookmark.content ? (getParsedContent(bookmark.content) as ParsedContent) : undefined,
    type: 'event' as const,
    isPrivate
  }))
}

// Types and guards around signer/decryption APIs
export function hydrateItems(
  items: IndividualBookmark[],
  idToEvent: Map<string, NostrEvent>
): IndividualBookmark[] {
  return items.map(item => {
    const ev = idToEvent.get(item.id)
    if (!ev) return item
    return {
      ...item,
      pubkey: ev.pubkey || item.pubkey,
      content: ev.content || item.content || '',
      created_at: ev.created_at || item.created_at,
      kind: ev.kind || item.kind,
      tags: ev.tags || item.tags,
      parsedContent: ev.content ? (getParsedContent(ev.content) as ParsedContent) : item.parsedContent
    }
  })
}

// Note: event decryption/collection lives in `bookmarkProcessing.ts`

export type DecryptFn = (pubkey: string, content: string) => Promise<string>
export type UnlockSigner = unknown
export type UnlockMode = unknown

export function hasNip44Decrypt(obj: unknown): obj is { nip44: { decrypt: DecryptFn } } {
  const nip44 = (obj as { nip44?: unknown })?.nip44 as { decrypt?: unknown } | undefined
  return typeof nip44?.decrypt === 'function'
}

export function hasNip04Decrypt(obj: unknown): obj is { nip04: { decrypt: DecryptFn } } {
  const nip04 = (obj as { nip04?: unknown })?.nip04 as { decrypt?: unknown } | undefined
  return typeof nip04?.decrypt === 'function'
}

export function dedupeBookmarksById(bookmarks: IndividualBookmark[]): IndividualBookmark[] {
  const seen = new Set<string>()
  const result: IndividualBookmark[] = []
  for (const b of bookmarks) {
    if (!seen.has(b.id)) {
      seen.add(b.id)
      result.push(b)
    }
  }
  return result
}

export function extractUrlsFromContent(content: string): string[] {
  if (!content) return []
  // Basic URL regex covering http(s) schemes
  const urlRegex = /https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/gi
  const matches = content.match(urlRegex)
  if (!matches) return []
  // Normalize by trimming trailing punctuation
  return Array.from(new Set(matches.map(u => u.replace(/[),.;]+$/, ''))))
}


