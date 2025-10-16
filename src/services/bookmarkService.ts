import { RelayPool } from 'applesauce-relay'
import {
  AccountWithExtension,
  NostrEvent,
  dedupeNip51Events,
  hydrateItems,
  isAccountWithExtension,
  hasNip04Decrypt,
  hasNip44Decrypt,
  dedupeBookmarksById,
  extractUrlsFromContent
} from './bookmarkHelpers'
import { Bookmark } from '../types/bookmarks'
import { collectBookmarksFromEvents } from './bookmarkProcessing.ts'
import { UserSettings } from './settingsService'
import { rebroadcastEvents } from './rebroadcastService'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'



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
    // Fetch bookmark events - NIP-51 standards, legacy formats, and web bookmarks (NIP-B0)
    console.log('🔍 Fetching bookmark events')

    const rawEvents = await queryEvents(
      relayPool,
      { kinds: [KINDS.ListSimple, KINDS.ListReplaceable, KINDS.List, KINDS.WebBookmark], authors: [activeAccount.pubkey] },
      {}
    )
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
      const eTags = evt.tags?.filter((t: string[]) => t[0] === 'e').length || 0
      const aTags = evt.tags?.filter((t: string[]) => t[0] === 'a').length || 0
      console.log(`  Event ${i}: kind=${evt.kind}, id=${evt.id?.slice(0, 8)}, dTag=${dTag}, contentLength=${evt.content?.length || 0}, eTags=${eTags}, aTags=${aTags}, contentPreview=${contentPreview}`)
    })

    const bookmarkListEvents = dedupeNip51Events(rawEvents)
    console.log('📋 After deduplication:', bookmarkListEvents.length, 'bookmark events')
    
    // Log which events made it through deduplication
    bookmarkListEvents.forEach((evt, i) => {
      const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || 'none'
      console.log(`  Dedupe ${i}: kind=${evt.kind}, id=${evt.id?.slice(0, 8)}, dTag="${dTag}"`)
    })
    
    // Check specifically for Primal's "reads" list
    const primalReads = rawEvents.find(e => e.kind === KINDS.ListSimple && e.tags?.find((t: string[]) => t[0] === 'd' && t[1] === 'reads'))
    if (primalReads) {
      console.log('✅ Found Primal reads list:', primalReads.id.slice(0, 8))
    } else {
      console.log('❌ No Primal reads list found (kind:10003 with d="reads")')
    }
    
    if (bookmarkListEvents.length === 0) {
      // Keep existing bookmarks visible; do not clear list if nothing new found
      return
    }
    // Aggregate across events
    const maybeAccount = activeAccount as AccountWithExtension
    console.log('[bunker] 🔐 Account object:', {
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

    console.log('[bunker] 🔑 Signer candidate:', !!signerCandidate, typeof signerCandidate)
    if (signerCandidate) {
      console.log('[bunker] 🔑 Signer has nip04:', hasNip04Decrypt(signerCandidate))
      console.log('[bunker] 🔑 Signer has nip44:', hasNip44Decrypt(signerCandidate))
    }
    
    // Debug relay connectivity for bunker relays
    try {
      const urls = Array.from(relayPool.relays.values()).map(r => ({ url: r.url, connected: (r as any).connected }))
      console.log('[bunker] Relay connections:', urls)
    } catch (err) { console.warn('[bunker] Failed to read relay connections', err) }

const { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags } = await collectBookmarksFromEvents(
      bookmarkListEvents,
      activeAccount,
      signerCandidate
    )

    const allItems = [...publicItemsAll, ...privateItemsAll]
    
    // Separate hex IDs (regular events) from coordinates (addressable events)
    const noteIds: string[] = []
    const coordinates: string[] = []
    
    allItems.forEach(i => {
      // Check if it's a hex ID (64 character hex string)
      if (/^[0-9a-f]{64}$/i.test(i.id)) {
        noteIds.push(i.id)
      } else if (i.id.includes(':')) {
        // Coordinate format: kind:pubkey:identifier
        coordinates.push(i.id)
      }
    })
    
    const idToEvent: Map<string, NostrEvent> = new Map()
    
    // Fetch regular events by ID
    if (noteIds.length > 0) {
      try {
        const events = await queryEvents(
          relayPool,
          { ids: Array.from(new Set(noteIds)) },
          { localTimeoutMs: 800, remoteTimeoutMs: 2500 }
        )
        events.forEach((e: NostrEvent) => {
          idToEvent.set(e.id, e)
          // Also store by coordinate if it's an addressable event
          if (e.kind && e.kind >= 30000 && e.kind < 40000) {
            const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
            const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
            idToEvent.set(coordinate, e)
          }
        })
      } catch (error) {
        console.warn('Failed to fetch events by ID:', error)
      }
    }
    
    // Fetch addressable events by coordinates
    if (coordinates.length > 0) {
      try {
        // Group by kind for more efficient querying
        const byKind = new Map<number, Array<{ pubkey: string; identifier: string }>>()
        
        coordinates.forEach(coord => {
          const parts = coord.split(':')
          const kind = parseInt(parts[0])
          const pubkey = parts[1]
          const identifier = parts[2] || ''
          
          if (!byKind.has(kind)) {
            byKind.set(kind, [])
          }
          byKind.get(kind)!.push({ pubkey, identifier })
        })
        
        // Query each kind group
        for (const [kind, items] of byKind.entries()) {
          const authors = Array.from(new Set(items.map(i => i.pubkey)))
          const identifiers = Array.from(new Set(items.map(i => i.identifier)))
          
          const events = await queryEvents(
            relayPool,
            { kinds: [kind], authors, '#d': identifiers },
            { localTimeoutMs: 800, remoteTimeoutMs: 2500 }
          )
          
          events.forEach((e: NostrEvent) => {
            const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
            const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
            idToEvent.set(coordinate, e)
            // Also store by event ID
            idToEvent.set(e.id, e)
          })
        }
      } catch (error) {
        console.warn('Failed to fetch addressable events:', error)
      }
    }
    
    console.log(`📦 Hydration: fetched ${idToEvent.size} events for ${allItems.length} bookmarks (${noteIds.length} notes, ${coordinates.length} articles)`)
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