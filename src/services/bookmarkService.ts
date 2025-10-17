import { RelayPool } from 'applesauce-relay'
import { Helpers } from 'applesauce-core'
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
import { KINDS } from '../config/kinds'

// Helper to check if event has encrypted content
const hasEncryptedContent = (evt: NostrEvent): boolean => {
  // Check for NIP-44 encrypted content (detected by Helpers)
  if (Helpers.hasHiddenContent(evt)) return true
  
  // Check for NIP-04 encrypted content (base64 with ?iv= suffix)
  if (evt.content && evt.content.includes('?iv=')) return true
  
  // Check for encrypted tags
  if (Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt)) return true
  
  return false
}

// Helper to deduplicate events by key
const getEventKey = (evt: NostrEvent): string => {
  if (evt.kind === 30003 || evt.kind === 30001) {
    // Replaceable: kind:pubkey:dtag
    const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
    return `${evt.kind}:${evt.pubkey}:${dTag}`
  } else if (evt.kind === 10003) {
    // Simple list: kind:pubkey
    return `${evt.kind}:${evt.pubkey}`
  }
  // Web bookmarks: use event id (no deduplication)
  return evt.id
}

export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: unknown,
  setBookmarks: (bookmarks: Bookmark[]) => void,
  settings?: UserSettings
) => {
  try {
    if (!isAccountWithExtension(activeAccount)) {
      throw new Error('Invalid account object provided')
    }

    console.log('[app] 🔍 Fetching bookmark events with streaming')

    // Track events with deduplication as they arrive
    const eventMap = new Map<string, NostrEvent>()
    let processedCount = 0
    
    console.log('[app] Account:', activeAccount.pubkey.slice(0, 8))

    // Get signer for auto-decryption
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

    // Stream events (just collect, decrypt after)
    const rawEvents = await queryEvents(
      relayPool,
      { kinds: [KINDS.ListSimple, KINDS.ListReplaceable, KINDS.List, KINDS.WebBookmark], authors: [activeAccount.pubkey] },
      {
        onEvent: (evt) => {
          // Deduplicate by key
          const key = getEventKey(evt)
          const existing = eventMap.get(key)
          
          if (existing && (existing.created_at || 0) >= (evt.created_at || 0)) {
            return // Keep existing (it's newer or same)
          }
          
          // Add/update event
          eventMap.set(key, evt)
          processedCount++
          
          console.log(`[app] 📨 Event ${processedCount}: kind=${evt.kind}, id=${evt.id.slice(0, 8)}, hasEncrypted=${hasEncryptedContent(evt)}`)
        }
      }
    )

    console.log('[app] 📊 Query complete, raw events fetched:', rawEvents.length, 'events')
    
    // Rebroadcast bookmark events to local/all relays based on settings
    await rebroadcastEvents(rawEvents, relayPool, settings)

    const dedupedEvents = Array.from(eventMap.values())
    console.log('[app] 📋 After deduplication:', dedupedEvents.length, 'bookmark events')
    
    if (dedupedEvents.length === 0) {
      console.log('[app] ⚠️  No bookmark events found')
      setBookmarks([]) // Clear bookmarks if none found
      return
    }

    // Auto-decrypt events with encrypted content (batch processing)
    const encryptedEvents = dedupedEvents.filter(evt => hasEncryptedContent(evt))
    if (encryptedEvents.length > 0) {
      console.log('[app] 🔓 Auto-decrypting', encryptedEvents.length, 'encrypted events')
      for (const evt of encryptedEvents) {
        try {
          // Trigger decryption - this unlocks the content for the main collection pass
          await collectBookmarksFromEvents([evt], activeAccount, signerCandidate)
          console.log('[app] ✅ Auto-decrypted:', evt.id.slice(0, 8))
        } catch (error) {
          console.error('[app] ❌ Auto-decrypt failed:', evt.id.slice(0, 8), error)
        }
      }
    }

    // Final update with all events (now with decrypted content)
    console.log('[app] 🔄 Final bookmark processing with', dedupedEvents.length, 'events')
    await updateBookmarks(dedupedEvents)
    console.log('[app] ✅ Bookmarks processing complete')

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
  }
}
