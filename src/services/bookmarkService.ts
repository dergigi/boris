import { RelayPool, completeOnEose } from 'applesauce-relay'
import { getParsedContent } from 'applesauce-content/text'
import { Helpers } from 'applesauce-core'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { Bookmark, IndividualBookmark, ParsedContent, ActiveAccount } from '../types/bookmarks'

interface BookmarkData {
  id?: string
  content?: string
  created_at?: number
  kind?: number
  tags?: string[][]
}

interface ApplesauceBookmarks {
  notes?: BookmarkData[]
  articles?: BookmarkData[]
  hashtags?: BookmarkData[]
  urls?: BookmarkData[]
}

interface AccountWithExtension { pubkey: string; signer?: unknown; [key: string]: unknown }

function isAccountWithExtension(account: unknown): account is AccountWithExtension {
  return typeof account === 'object' && account !== null && 'pubkey' in account
}

function isEncryptedContent(content: string | undefined): boolean {
  if (!content) return false
  return (
    content.startsWith('nip44:') || content.startsWith('nip04:') || content.includes('?iv=') || content.includes('?version=')
  )
}

function isHexId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{64}$/i.test(id)
}

function dedupeNip51Events(events: any[]): any[] {
  const byId = new Map<string, any>()
  for (const e of events) { if (e?.id && !byId.has(e.id)) byId.set(e.id, e) }
  const unique = Array.from(byId.values())
  const latest10003 = unique
    .filter(e => e.kind === 10003)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0]
  const byD = new Map<string, any>()
  for (const e of unique) {
    if (e.kind !== 30001) continue
    const d = (e.tags || []).find((t: string[]) => t[0] === 'd')?.[1] || ''
    const prev = byD.get(d)
    if (!prev || (e.created_at || 0) > (prev.created_at || 0)) byD.set(d, e)
  }
  const sets30001 = Array.from(byD.values())
  const out: any[] = []
  if (latest10003) out.push(latest10003)
  out.push(...sets30001)
  return out
}

const processApplesauceBookmarks = (
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
      created_at: bookmark.created_at || Date.now(),
      pubkey: activeAccount.pubkey,
      kind: bookmark.kind || 30001,
      tags: bookmark.tags || [],
      parsedContent: bookmark.content ? getParsedContent(bookmark.content) as ParsedContent : undefined,
      type: 'event' as const,
      isPrivate
    }))
  }
  // Fallback: map array-like bookmarks
  const bookmarkArray = Array.isArray(bookmarks) ? bookmarks : [bookmarks]
  return bookmarkArray.map((bookmark: BookmarkData) => ({
    id: bookmark.id || `${isPrivate ? 'private' : 'public'}-${Date.now()}`,
    content: bookmark.content || '',
    created_at: bookmark.created_at || Date.now(),
    pubkey: activeAccount.pubkey,
    kind: bookmark.kind || 30001,
    tags: bookmark.tags || [],
    parsedContent: bookmark.content ? getParsedContent(bookmark.content) as ParsedContent : undefined,
    type: 'event' as const,
    isPrivate
  }))
}



export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: unknown, // Full account object with extension capabilities
  setBookmarks: (bookmarks: Bookmark[]) => void,
  setLoading: (loading: boolean) => void,
  timeoutId: number
) => {
  try {
    setLoading(true)
    
    if (!isAccountWithExtension(activeAccount)) {
      throw new Error('Invalid account object provided')
    }
    // Get relay URLs from the pool
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    // Fetch bookmark list (10003 latest) and bookmarksets (30001 latest per d)
    const rawEvents = await lastValueFrom(
      relayPool
        .req(relayUrls, { kinds: [10003, 30001], authors: [activeAccount.pubkey] })
        .pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    const bookmarkListEvents = dedupeNip51Events(rawEvents)
    if (bookmarkListEvents.length === 0) {
      setBookmarks([])
      setLoading(false)
      return
    }
    // Aggregate across events
    const maybeAccount = activeAccount as any
    const signerCandidate = typeof maybeAccount?.signEvent === 'function' ? maybeAccount : maybeAccount?.signer
    const publicItemsAll: IndividualBookmark[] = []
    const privateItemsAll: IndividualBookmark[] = []
    let newestCreatedAt = 0
    let latestContent = ''
    let allTags: string[][] = []
    for (const evt of bookmarkListEvents) {
      newestCreatedAt = Math.max(newestCreatedAt, evt.created_at || 0)
      if (!latestContent && evt.content && !isEncryptedContent(evt.content)) latestContent = evt.content
      if (Array.isArray(evt.tags)) allTags = allTags.concat(evt.tags)
      // public
      const pub = Helpers.getPublicBookmarks(evt)
      publicItemsAll.push(...processApplesauceBookmarks(pub, activeAccount, false))
      // hidden
      try {
        if (Helpers.hasHiddenTags(evt) && Helpers.isHiddenTagsLocked(evt) && signerCandidate) {
          try {
            await Helpers.unlockHiddenTags(evt, signerCandidate)
          } catch {
            await Helpers.unlockHiddenTags(evt, signerCandidate as any, 'nip44' as any)
          }
        }
        const priv = Helpers.getHiddenBookmarks(evt)
        privateItemsAll.push(...processApplesauceBookmarks(priv, activeAccount, true))
      } catch {
        // ignore per-event failures
      }
    }

    const allItems = [...publicItemsAll, ...privateItemsAll]
    const noteIds = Array.from(new Set(allItems.map(i => i.id).filter(isHexId)))
    let idToEvent: Map<string, any> = new Map()
    if (noteIds.length > 0) {
      try {
        const events = await lastValueFrom(
          relayPool.req(relayUrls, { ids: noteIds }).pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
        )
        idToEvent = new Map(events.map((e: any) => [e.id, e]))
      } catch {}
    }
    const hydrateItems = (items: IndividualBookmark[]): IndividualBookmark[] => items.map(item => {
      const ev = idToEvent.get(item.id)
      if (!ev) return item
      return {
        ...item,
        content: ev.content || item.content || '',
        created_at: ev.created_at || item.created_at,
        kind: ev.kind || item.kind,
        tags: ev.tags || item.tags,
        parsedContent: ev.content ? getParsedContent(ev.content) as ParsedContent : item.parsedContent
      }
    })
    const allBookmarks = [...hydrateItems(publicItemsAll), ...hydrateItems(privateItemsAll)]
    
    const bookmark: Bookmark = {
      id: `${activeAccount.pubkey}-bookmarks`,
      title: `Bookmarks (${allBookmarks.length})`,
      url: '',
      content: latestContent,
      created_at: newestCreatedAt || Date.now(),
      tags: allTags,
      bookmarkCount: allBookmarks.length,
      eventReferences: allTags.filter(tag => tag[0] === 'e').map(tag => tag[1]),
      individualBookmarks: allBookmarks,
      isPrivate: privateItemsAll.length > 0,
      encryptedContent: undefined
    }
    
    setBookmarks([bookmark])
    clearTimeout(timeoutId)
    setLoading(false)

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
    clearTimeout(timeoutId)
    setLoading(false)
  }
}