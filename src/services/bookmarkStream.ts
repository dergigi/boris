import { RelayPool } from 'applesauce-relay'
import { Helpers } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { collectBookmarksFromEvents } from './bookmarkProcessing'

/**
 * Get unique key for event deduplication
 * Replaceable events (30001, 30003) use kind:pubkey:dtag
 * Simple lists (10003) use kind:pubkey
 * Web bookmarks (39701) use event id
 */
export function getEventKey(evt: NostrEvent): string {
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

/**
 * Check if event has encrypted content
 * Detects NIP-44 (via Helpers), NIP-04 (?iv= suffix), and encrypted tags
 */
export function hasEncryptedContent(evt: NostrEvent): boolean {
  // Check for NIP-44 encrypted content (detected by Helpers)
  if (Helpers.hasHiddenContent(evt)) return true
  
  // Check for NIP-04 encrypted content (base64 with ?iv= suffix)
  if (evt.content && evt.content.includes('?iv=')) return true
  
  // Check for encrypted tags
  if (Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt)) return true
  
  return false
}

interface LoadBookmarksStreamOptions {
  relayPool: RelayPool
  activeAccount: { pubkey: string; [key: string]: unknown }
  accountManager: { getActive: () => unknown }
  onEvent?: (event: NostrEvent) => void
  onDecryptStart?: (eventId: string) => void
  onDecryptComplete?: (eventId: string, success: boolean) => void
}

interface LoadBookmarksStreamResult {
  events: NostrEvent[]
  decryptedCount: number
}

/**
 * Load bookmark events with streaming and non-blocking decryption
 * - Streams events via onEvent callback as they arrive
 * - Deduplicates by getEventKey
 * - Decrypts encrypted events AFTER query completes (non-blocking UI)
 * - Trusts EOSE signal to complete
 */
export async function loadBookmarksStream(
  options: LoadBookmarksStreamOptions
): Promise<LoadBookmarksStreamResult> {
  const {
    relayPool,
    activeAccount,
    accountManager,
    onEvent,
    onDecryptStart,
    onDecryptComplete
  } = options

  console.log('[app] 🔍 Fetching bookmark events with streaming')
  console.log('[app] Account:', activeAccount.pubkey.slice(0, 8))

  // Track events with deduplication as they arrive
  const eventMap = new Map<string, NostrEvent>()
  let processedCount = 0

  // Get signer for auto-decryption
  const fullAccount = accountManager.getActive() as {
    pubkey: string
    signer?: unknown
    nip04?: unknown
    nip44?: unknown
    [key: string]: unknown
  } | null
  const maybeAccount = fullAccount || activeAccount
  let signerCandidate: unknown = maybeAccount
  const hasNip04Prop = (signerCandidate as { nip04?: unknown })?.nip04 !== undefined
  const hasNip44Prop = (signerCandidate as { nip44?: unknown })?.nip44 !== undefined
  if (signerCandidate && !hasNip04Prop && !hasNip44Prop && maybeAccount?.signer) {
    signerCandidate = maybeAccount.signer
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
        
        // Call optional callback for progressive UI updates
        if (onEvent) {
          onEvent(evt)
        }
      }
    }
  )

  console.log('[app] 📊 Query complete, raw events fetched:', rawEvents.length, 'events')

  const dedupedEvents = Array.from(eventMap.values())
  console.log('[app] 📋 After deduplication:', dedupedEvents.length, 'bookmark events')
  
  if (dedupedEvents.length === 0) {
    console.log('[app] ⚠️  No bookmark events found')
    return { events: [], decryptedCount: 0 }
  }

  // Auto-decrypt events with encrypted content (batch processing after EOSE)
  const encryptedEvents = dedupedEvents.filter(evt => hasEncryptedContent(evt))
  let decryptedCount = 0
  
  if (encryptedEvents.length > 0) {
    console.log('[app] 🔓 Auto-decrypting', encryptedEvents.length, 'encrypted events')
    for (const evt of encryptedEvents) {
      try {
        if (onDecryptStart) {
          onDecryptStart(evt.id)
        }
        
        // Trigger decryption - this unlocks the content for the bookmark collection
        await collectBookmarksFromEvents([evt], activeAccount, signerCandidate)
        decryptedCount++
        console.log('[app] ✅ Auto-decrypted:', evt.id.slice(0, 8))
        
        if (onDecryptComplete) {
          onDecryptComplete(evt.id, true)
        }
      } catch (error) {
        console.error('[app] ❌ Auto-decrypt failed:', evt.id.slice(0, 8), error)
        if (onDecryptComplete) {
          onDecryptComplete(evt.id, false)
        }
      }
    }
  }

  console.log('[app] ✅ Bookmark streaming complete:', dedupedEvents.length, 'events,', decryptedCount, 'decrypted')

  return { events: dedupedEvents, decryptedCount }
}

