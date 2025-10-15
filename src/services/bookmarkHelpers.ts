import { getParsedContent } from 'applesauce-content/text'
import { Helpers } from 'applesauce-core'
import { ActiveAccount, IndividualBookmark, ParsedContent } from '../types/bookmarks'
import type { NostrEvent } from './bookmarkEvents'

const { getArticleTitle } = Helpers

// Global symbol for caching hidden bookmark content on events
export const BookmarkHiddenSymbol = Symbol.for('bookmark-hidden')

export interface BookmarkData {
  id?: string
  content?: string
  created_at?: number
  kind?: number
  tags?: string[][]
}

export interface AddressPointer {
  kind: number
  pubkey: string
  identifier: string
  relays?: string[]
}

export interface EventPointer {
  id: string
  relays?: string[]
  author?: string
}

export interface ApplesauceBookmarks {
  notes?: EventPointer[]
  articles?: AddressPointer[]
  hashtags?: string[]
  urls?: string[]
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
    const allItems: IndividualBookmark[] = []
    
    // Process notes (EventPointer[])
    if (applesauceBookmarks.notes) {
      applesauceBookmarks.notes.forEach((note: EventPointer) => {
        allItems.push({
          id: note.id,
          content: '',
          created_at: Math.floor(Date.now() / 1000),
          pubkey: note.author || activeAccount.pubkey,
          kind: 1, // Short note kind
          tags: [],
          parsedContent: undefined,
          type: 'event' as const,
          isPrivate,
          added_at: Math.floor(Date.now() / 1000)
        })
      })
    }
    
    // Process articles (AddressPointer[])
    if (applesauceBookmarks.articles) {
      applesauceBookmarks.articles.forEach((article: AddressPointer) => {
        // Convert AddressPointer to coordinate format: kind:pubkey:identifier
        const coordinate = `${article.kind}:${article.pubkey}:${article.identifier || ''}`
        allItems.push({
          id: coordinate,
          content: '',
          created_at: Math.floor(Date.now() / 1000),
          pubkey: article.pubkey,
          kind: article.kind, // Usually 30023 for long-form articles
          tags: [],
          parsedContent: undefined,
          type: 'event' as const,
          isPrivate,
          added_at: Math.floor(Date.now() / 1000)
        })
      })
    }
    
    // Process hashtags (string[])
    if (applesauceBookmarks.hashtags) {
      applesauceBookmarks.hashtags.forEach((hashtag: string) => {
        allItems.push({
          id: `hashtag-${hashtag}`,
          content: `#${hashtag}`,
          created_at: Math.floor(Date.now() / 1000),
          pubkey: activeAccount.pubkey,
          kind: 1,
          tags: [['t', hashtag]],
          parsedContent: undefined,
          type: 'event' as const,
          isPrivate,
          added_at: Math.floor(Date.now() / 1000)
        })
      })
    }
    
    // Process URLs (string[])
    if (applesauceBookmarks.urls) {
      applesauceBookmarks.urls.forEach((url: string) => {
        allItems.push({
          id: `url-${url}`,
          content: url,
          created_at: Math.floor(Date.now() / 1000),
          pubkey: activeAccount.pubkey,
          kind: 1,
          tags: [['r', url]],
          parsedContent: undefined,
          type: 'event' as const,
          isPrivate,
          added_at: Math.floor(Date.now() / 1000)
        })
      })
    }
    
    return allItems
  }

  const bookmarkArray = Array.isArray(bookmarks) ? bookmarks : [bookmarks]
  return bookmarkArray
    .filter((bookmark: BookmarkData) => bookmark.id) // Skip bookmarks without valid IDs
    .map((bookmark: BookmarkData) => ({
      id: bookmark.id!,
      content: bookmark.content || '',
      created_at: bookmark.created_at || Math.floor(Date.now() / 1000),
      pubkey: activeAccount.pubkey,
      kind: bookmark.kind || 30001,
      tags: bookmark.tags || [],
      parsedContent: bookmark.content ? (getParsedContent(bookmark.content) as ParsedContent) : undefined,
      type: 'event' as const,
      isPrivate,
      added_at: bookmark.created_at || Math.floor(Date.now() / 1000)
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
    
    // For long-form articles (kind:30023), use the article title as content
    let content = ev.content || item.content || ''
    if (ev.kind === 30023) {
      const articleTitle = getArticleTitle(ev)
      if (articleTitle) {
        content = articleTitle
      }
    }
    
    return {
      ...item,
      pubkey: ev.pubkey || item.pubkey,
      content,
      created_at: ev.created_at || item.created_at,
      kind: ev.kind || item.kind,
      tags: ev.tags || item.tags,
      parsedContent: ev.content ? (getParsedContent(content) as ParsedContent) : item.parsedContent
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


