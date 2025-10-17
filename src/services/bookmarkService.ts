import { RelayPool } from 'applesauce-relay'
import {
  AccountWithExtension,
  NostrEvent,
  hydrateItems,
  isAccountWithExtension,
  dedupeBookmarksById,
  extractUrlsFromContent
} from './bookmarkHelpers'
import { Bookmark } from '../types/bookmarks'
import { collectBookmarksFromEvents } from './bookmarkProcessing.ts'
import { UserSettings } from './settingsService'
import { rebroadcastEvents } from './rebroadcastService'
import { queryEvents } from './dataFetch'
import { loadBookmarksStream } from './bookmarkStream'

export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: unknown,
  accountManager: { getActive: () => unknown },
  setBookmarks: (bookmarks: Bookmark[]) => void,
  settings?: UserSettings,
  onProgressUpdate?: () => void
) => {
  try {
    if (!isAccountWithExtension(activeAccount)) {
      throw new Error('Invalid account object provided')
    }

    // Get signer for bookmark processing
    const maybeAccount = activeAccount as AccountWithExtension
    let signerCandidate: unknown = maybeAccount
    const hasNip04Prop = (signerCandidate as { nip04?: unknown })?.nip04 !== undefined
    const hasNip44Prop = (signerCandidate as { nip44?: unknown })?.nip44 !== undefined
    if (signerCandidate && !hasNip04Prop && !hasNip44Prop && maybeAccount?.signer) {
      signerCandidate = maybeAccount.signer
    }

    // Helper to build and update bookmark from current events
    const updateBookmarks = async (events: NostrEvent[]) => {
      if (events.length === 0) return

      // Collect bookmarks from all events
      const { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags } = 
        await collectBookmarksFromEvents(events, activeAccount, signerCandidate)

      const allItems = [...publicItemsAll, ...privateItemsAll]
      
      // Separate hex IDs from coordinates
      const noteIds: string[] = []
      const coordinates: string[] = []
      
      allItems.forEach(i => {
        if (/^[0-9a-f]{64}$/i.test(i.id)) {
          noteIds.push(i.id)
        } else if (i.id.includes(':')) {
          coordinates.push(i.id)
        }
      })
      
      const idToEvent: Map<string, NostrEvent> = new Map()
      
      // Fetch regular events by ID
      if (noteIds.length > 0) {
        try {
          const fetchedEvents = await queryEvents(
            relayPool,
            { ids: Array.from(new Set(noteIds)) },
            {}
          )
          fetchedEvents.forEach((e: NostrEvent) => {
            idToEvent.set(e.id, e)
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
          
          for (const [kind, items] of byKind.entries()) {
            const authors = Array.from(new Set(items.map(i => i.pubkey)))
            const identifiers = Array.from(new Set(items.map(i => i.identifier)))
            
            const fetchedEvents = await queryEvents(
              relayPool,
              { kinds: [kind], authors, '#d': identifiers },
              {}
            )
            
            fetchedEvents.forEach((e: NostrEvent) => {
              const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
              const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
              idToEvent.set(coordinate, e)
              idToEvent.set(e.id, e)
            })
          }
        } catch (error) {
          console.warn('Failed to fetch addressable events:', error)
        }
      }
      
      const allBookmarks = dedupeBookmarksById([
        ...hydrateItems(publicItemsAll, idToEvent),
        ...hydrateItems(privateItemsAll, idToEvent)
      ])

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
    }

    // Use shared streaming helper for consistent behavior with Debug page
    // Progressive updates via callbacks (non-blocking)
    const { events: dedupedEvents } = await loadBookmarksStream({
      relayPool,
      activeAccount: maybeAccount,
      accountManager,
      onEvent: () => {
        // Signal that an event arrived (for loading indicator updates)
        if (onProgressUpdate) {
          onProgressUpdate()
        }
      },
      onDecryptComplete: () => {
        // Signal that a decrypt completed (for loading indicator updates)
        if (onProgressUpdate) {
          onProgressUpdate()
        }
      }
    })

    // Rebroadcast bookmark events to local/all relays based on settings
    await rebroadcastEvents(dedupedEvents, relayPool, settings)

    if (dedupedEvents.length === 0) {
      console.log('[app] ⚠️  No bookmark events found')
      setBookmarks([])
      return
    }

    // Final update with all events (now with decrypted content)
    console.log('[app] 🔄 Final bookmark processing with', dedupedEvents.length, 'events')
    await updateBookmarks(dedupedEvents)
    console.log('[app] ✅ Bookmarks processing complete')

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
  }
}
