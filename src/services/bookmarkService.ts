import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import {
  AccountWithExtension,
  NostrEvent,
  dedupeNip51Events,
  hydrateItems,
  isAccountWithExtension,
  isHexId,
  hasNip04Decrypt,
  hasNip44Decrypt,
  dedupeBookmarksById,
  extractUrlsFromContent
} from './bookmarkHelpers'
import { Bookmark } from '../types/bookmarks'
import { collectBookmarksFromEvents } from './bookmarkProcessing.ts'
import { UserSettings } from './settingsService'
import { rebroadcastEvents } from './rebroadcastService'
import { prioritizeLocalRelays } from '../utils/helpers'



export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: unknown, // Full account object with extension capabilities
  setBookmarks: (bookmarks: Bookmark[]) => void,
  settings?: UserSettings
) => {
  try {
    
    if (!isAccountWithExtension(activeAccount)) {
      throw new Error('Invalid account object provided')
    }
    // Get relay URLs from the pool
    const relayUrls = prioritizeLocalRelays(Array.from(relayPool.relays.values()).map(relay => relay.url))
    // Fetch bookmark events - NIP-51 standards, legacy formats, and web bookmarks (NIP-B0)
    console.log('🔍 Fetching bookmark events from relays:', relayUrls)
    // Try local-first quickly, then full set fallback
    let rawEvents = [] as NostrEvent[]
    const localRelays = relayUrls.filter(url => url.includes('localhost') || url.includes('127.0.0.1'))
    if (localRelays.length > 0) {
      try {
        rawEvents = await lastValueFrom(
          relayPool
            .req(localRelays, { kinds: [10003, 30003, 30001, 39701], authors: [activeAccount.pubkey] })
            .pipe(completeOnEose(), takeUntil(timer(1200)), toArray())
        )
      } catch {
        rawEvents = []
      }
    }
    if (rawEvents.length === 0) {
      rawEvents = await lastValueFrom(
        relayPool
          .req(relayUrls, { kinds: [10003, 30003, 30001, 39701], authors: [activeAccount.pubkey] })
          .pipe(completeOnEose(), takeUntil(timer(6000)), toArray())
      )
    }
    console.log('📊 Raw events fetched:', rawEvents.length, 'events')
    
    // Rebroadcast bookmark events to local/all relays based on settings
    await rebroadcastEvents(rawEvents, relayPool, settings)

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
    let signerCandidate: unknown = maybeAccount
    const hasNip04Prop = (signerCandidate as { nip04?: unknown })?.nip04 !== undefined
    const hasNip44Prop = (signerCandidate as { nip44?: unknown })?.nip44 !== undefined
    if (signerCandidate && !hasNip04Prop && !hasNip44Prop && maybeAccount?.signer) {
      // Fallback to the raw signer if account doesn't have nip04/nip44
      signerCandidate = maybeAccount.signer
    }

    console.log('🔑 Signer candidate:', !!signerCandidate, typeof signerCandidate)
    if (signerCandidate) {
      console.log('🔑 Signer has nip04:', hasNip04Decrypt(signerCandidate))
      console.log('🔑 Signer has nip44:', hasNip44Decrypt(signerCandidate))
    }
    const { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags } = await collectBookmarksFromEvents(
      bookmarkListEvents,
      activeAccount,
      signerCandidate
    )

    const allItems = [...publicItemsAll, ...privateItemsAll]
    const noteIds = Array.from(new Set(allItems.map(i => i.id).filter(isHexId)))
    let idToEvent: Map<string, NostrEvent> = new Map()
    if (noteIds.length > 0) {
      try {
        const events = await lastValueFrom(
          relayPool
            .req(relayUrls, { ids: noteIds })
            .pipe(completeOnEose(), takeUntil(timer(4000)), toArray())
        )
        idToEvent = new Map(events.map((e: NostrEvent) => [e.id, e]))
      } catch (error) {
        console.warn('Failed to fetch events for hydration:', error)
      }
    }
    const allBookmarks = dedupeBookmarksById([
      ...hydrateItems(publicItemsAll, idToEvent),
      ...hydrateItems(privateItemsAll, idToEvent)
    ])

    // Sort individual bookmarks by "added" timestamp first (most recently added first),
    // falling back to event created_at when unknown.
    const enriched = allBookmarks.map(b => ({
      ...b,
      tags: b.tags || [],
      content: b.content || ''
    }))
    const sortedBookmarks = enriched
      .map(b => ({ ...b, urlReferences: extractUrlsFromContent(b.content) }))
      .sort((a, b) => ((b.added_at || 0) - (a.added_at || 0)) || ((b.created_at || 0) - (a.created_at || 0)))

    const bookmark: Bookmark = {
      id: `${activeAccount.pubkey}-bookmarks`,
      title: `Bookmarks (${sortedBookmarks.length})`,
      url: '',
      content: latestContent,
      created_at: newestCreatedAt || Math.floor(Date.now() / 1000),
      tags: allTags,
      bookmarkCount: sortedBookmarks.length,
      eventReferences: allTags.filter((tag: string[]) => tag[0] === 'e').map((tag: string[]) => tag[1]),
      individualBookmarks: sortedBookmarks,
      isPrivate: privateItemsAll.length > 0,
      encryptedContent: undefined
    }
    
    setBookmarks([bookmark])

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
  }
}