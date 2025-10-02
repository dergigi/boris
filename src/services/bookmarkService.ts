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

interface AccountWithExtension { pubkey: string; signer?: unknown; nip04?: unknown; nip44?: unknown; [key: string]: unknown }

function isAccountWithExtension(account: unknown): account is AccountWithExtension {
  return typeof account === 'object' && account !== null && 'pubkey' in account && typeof (account as any).pubkey === 'string'
}

// Note: Using applesauce's built-in hidden content detection instead of custom logic
// Encrypted content detection is handled by applesauce's hasHiddenContent() function

function isHexId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{64}$/i.test(id)
}

interface NostrEvent {
  id: string
  kind: number
  created_at: number
  tags: string[][]
  content: string
  pubkey: string
  sig: string
}

function dedupeNip51Events(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>()
  for (const e of events) { if (e?.id && !byId.has(e.id)) byId.set(e.id, e) }
  const unique = Array.from(byId.values())

  // Get the latest bookmark list (10003/30001) - default bookmark list without 'd' tag
  const bookmarkLists = unique
    .filter(e => e.kind === 10003 || e.kind === 30001)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  const latestBookmarkList = bookmarkLists.find(list =>
    !list.tags?.some((t: string[]) => t[0] === 'd')
  )

  // Group bookmark sets (30003) and named bookmark lists (10003/30001 with 'd' tag) by their 'd' identifier
  const byD = new Map<string, NostrEvent>()
  for (const e of unique) {
    if (e.kind === 10003 || e.kind === 30003 || e.kind === 30001) {
      const d = (e.tags || []).find((t: string[]) => t[0] === 'd')?.[1] || ''
      const prev = byD.get(d)
      if (!prev || (e.created_at || 0) > (prev.created_at || 0)) byD.set(d, e)
    }
  }

  const setsAndNamedLists = Array.from(byD.values())
  const out: NostrEvent[] = []

  // Add the default bookmark list if it exists
  if (latestBookmarkList) out.push(latestBookmarkList)

  // Add all bookmark sets and named bookmark lists
  out.push(...setsAndNamedLists)

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
    // Fetch bookmark events - NIP-51 standards and legacy formats
    console.log('🔍 Fetching bookmark events from relays:', relayUrls)
    const rawEvents = await lastValueFrom(
      relayPool
        .req(relayUrls, { kinds: [10003, 30003, 30001], authors: [activeAccount.pubkey] })
        .pipe(completeOnEose(), takeUntil(timer(20000)), toArray())
    )
    console.log('📊 Raw events fetched:', rawEvents.length, 'events')

    // Check for events with potentially encrypted content
    const eventsWithContent = rawEvents.filter(evt => evt.content && evt.content.length > 0)
    if (eventsWithContent.length > 0) {
      console.log('🔐 Events with content (potentially encrypted):', eventsWithContent.length)
      eventsWithContent.forEach((evt, i) => {
        const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || 'none'
        const contentPreview = evt.content.slice(0, 60) + (evt.content.length > 60 ? '...' : '')
        console.log(`  Encrypted Event ${i}: kind=${evt.kind}, id=${evt.id?.slice(0, 8)}, dTag=${dTag}, contentLength=${evt.content.length}, preview=${contentPreview}`)
      })
    }

    rawEvents.forEach((evt, i) => {
      const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || 'none'
      const contentPreview = evt.content ? evt.content.slice(0, 50) + (evt.content.length > 50 ? '...' : '') : 'empty'
      console.log(`  Event ${i}: kind=${evt.kind}, id=${evt.id?.slice(0, 8)}, dTag=${dTag}, contentLength=${evt.content?.length || 0}, contentPreview=${contentPreview}`)
    })

    const bookmarkListEvents = dedupeNip51Events(rawEvents)
    console.log('📋 After deduplication:', bookmarkListEvents.length, 'bookmark events')
    if (bookmarkListEvents.length === 0) {
      setBookmarks([])
      setLoading(false)
      return
    }
    // Aggregate across events
    const maybeAccount = activeAccount as AccountWithExtension
    console.log('🔐 Account object:', {
      hasSignEvent: typeof maybeAccount?.signEvent === 'function',
      hasSigner: !!maybeAccount?.signer,
      accountType: typeof maybeAccount,
      accountKeys: maybeAccount ? Object.keys(maybeAccount) : []
    })

    // For ExtensionAccount, we need a signer with nip04/nip44 for decrypting hidden content
    // The ExtensionAccount itself has nip04/nip44 getters that proxy to the signer
    let signerCandidate: any = maybeAccount
    if (signerCandidate && !(signerCandidate as any).nip04 && !(signerCandidate as any).nip44 && maybeAccount?.signer) {
      // Fallback to the raw signer if account doesn't have nip04/nip44
      signerCandidate = maybeAccount.signer
    }

    console.log('🔑 Signer candidate:', !!signerCandidate, typeof signerCandidate)
    if (signerCandidate) {
      console.log('🔑 Signer has nip04:', !!(signerCandidate as any).nip04)
      console.log('🔑 Signer has nip44:', !!(signerCandidate as any).nip44)
    }
    const publicItemsAll: IndividualBookmark[] = []
    const privateItemsAll: IndividualBookmark[] = []
    let newestCreatedAt = 0
    let latestContent = ''
    let allTags: string[][] = []
    for (const evt of bookmarkListEvents) {
      const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || 'none'
      const firstFewTags = evt.tags?.slice(0, 3).map((t: string[]) => `${t[0]}:${t[1]?.slice(0, 8)}`).join(', ') || 'none'

      console.log('📋 Processing bookmark event:', {
        id: evt.id?.slice(0, 8),
        kind: evt.kind,
        contentLength: evt.content?.length || 0,
        contentPreview: evt.content?.slice(0, 50) + (evt.content?.length > 50 ? '...' : ''),
        tagsCount: evt.tags?.length || 0,
        hasHiddenContent: Helpers.hasHiddenContent(evt),
        canHaveHiddenTags: Helpers.canHaveHiddenTags(evt.kind),
        dTag: dTag,
        firstFewTags: firstFewTags
      })

      newestCreatedAt = Math.max(newestCreatedAt, evt.created_at || 0)
      if (!latestContent && evt.content && !Helpers.hasHiddenContent(evt)) latestContent = evt.content
      if (Array.isArray(evt.tags)) allTags = allTags.concat(evt.tags)
      // public
      const pub = Helpers.getPublicBookmarks(evt)
      publicItemsAll.push(...processApplesauceBookmarks(pub, activeAccount, false))
      // hidden
      try {
        console.log('🔒 Event has hidden tags:', Helpers.hasHiddenTags(evt))
        console.log('🔒 Hidden tags locked:', Helpers.isHiddenTagsLocked(evt))
        console.log('🔒 Signer candidate available:', !!signerCandidate)
        console.log('🔒 Signer candidate type:', typeof signerCandidate)
        console.log('🔒 Event kind supports hidden tags:', Helpers.canHaveHiddenTags(evt.kind))

        if (Helpers.hasHiddenTags(evt) && Helpers.isHiddenTagsLocked(evt) && signerCandidate) {
          try {
            console.log('🔓 Attempting to unlock hidden tags with signer...')
            await Helpers.unlockHiddenTags(evt, signerCandidate as any)
            console.log('✅ Successfully unlocked hidden tags')
          } catch (error) {
            console.warn('❌ Failed to unlock with default method, trying NIP-44:', error)
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await Helpers.unlockHiddenTags(evt, signerCandidate as any, 'nip44' as any)
              console.log('✅ Successfully unlocked hidden tags with NIP-44')
            } catch (nip44Error) {
              console.error('❌ Failed to unlock with NIP-44:', nip44Error)
            }
          }
        }

        const priv = Helpers.getHiddenBookmarks(evt)
        console.log('🔍 Hidden bookmarks found:', priv ? Object.keys(priv).map(k => `${k}: ${priv[k as keyof typeof priv]?.length || 0}`).join(', ') : 'none')
        if (priv) {
          privateItemsAll.push(...processApplesauceBookmarks(priv, activeAccount, true))
        }
      } catch (error) {
        console.warn('❌ Failed to process hidden bookmarks for event:', evt.id, error)
      }
    }

    const allItems = [...publicItemsAll, ...privateItemsAll]
    const noteIds = Array.from(new Set(allItems.map(i => i.id).filter(isHexId)))
    let idToEvent: Map<string, NostrEvent> = new Map()
    if (noteIds.length > 0) {
      try {
        const events = await lastValueFrom(
          relayPool.req(relayUrls, { ids: noteIds }).pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
        )
        idToEvent = new Map(events.map((e: NostrEvent) => [e.id, e]))
      } catch (error) {
        console.warn('Failed to fetch events for hydration:', error)
      }
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

    // Sort individual bookmarks by timestamp (newest first)
    const sortedBookmarks = allBookmarks.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))

    const bookmark: Bookmark = {
      id: `${activeAccount.pubkey}-bookmarks`,
      title: `Bookmarks (${sortedBookmarks.length})`,
      url: '',
      content: latestContent,
      created_at: newestCreatedAt || Date.now(),
      tags: allTags,
      bookmarkCount: sortedBookmarks.length,
      eventReferences: allTags.filter(tag => tag[0] === 'e').map(tag => tag[1]),
      individualBookmarks: sortedBookmarks,
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