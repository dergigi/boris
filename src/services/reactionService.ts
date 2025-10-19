import { EventFactory } from 'applesauce-factory'
import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { RELAYS } from '../config/relays'

const MARK_AS_READ_EMOJI = '📚'

export { MARK_AS_READ_EMOJI }

/**
 * Creates a kind:7 reaction to a nostr event (for nostr-native articles)
 * @param eventId The ID of the event being reacted to
 * @param eventAuthor The pubkey of the event author
 * @param eventKind The kind of the event being reacted to
 * @param account The user's account for signing
 * @param relayPool The relay pool for publishing
 * @returns The signed reaction event
 */
export async function createEventReaction(
  eventId: string,
  eventAuthor: string,
  eventKind: number,
  account: IAccount,
  relayPool: RelayPool
): Promise<NostrEvent> {
  const factory = new EventFactory({ signer: account })

  const tags: string[][] = [
    ['e', eventId],
    ['p', eventAuthor],
    ['k', eventKind.toString()]
  ]

  const draft = await factory.create(async () => ({
    kind: 7, // Reaction
    content: MARK_AS_READ_EMOJI,
    tags,
    created_at: Math.floor(Date.now() / 1000)
  }))

  const signed = await factory.sign(draft)


  // Publish to relays
  await relayPool.publish(RELAYS, signed)


  return signed
}

/**
 * Creates a kind:17 reaction to a website (for external URLs)
 * @param url The URL being reacted to
 * @param account The user's account for signing
 * @param relayPool The relay pool for publishing
 * @returns The signed reaction event
 */
export async function createWebsiteReaction(
  url: string,
  account: IAccount,
  relayPool: RelayPool
): Promise<NostrEvent> {
  const factory = new EventFactory({ signer: account })

  // Normalize URL (remove fragments, trailing slashes as per NIP-25)
  let normalizedUrl = url
  try {
    const parsed = new URL(url)
    // Remove fragment
    parsed.hash = ''
    normalizedUrl = parsed.toString()
    // Remove trailing slash if present
    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1)
    }
  } catch (error) {
    console.warn('Failed to normalize URL:', error)
  }

  const tags: string[][] = [
    ['r', normalizedUrl]
  ]

  const draft = await factory.create(async () => ({
    kind: 17, // Reaction to a website
    content: MARK_AS_READ_EMOJI,
    tags,
    created_at: Math.floor(Date.now() / 1000)
  }))

  const signed = await factory.sign(draft)


  // Publish to relays
  await relayPool.publish(RELAYS, signed)


  return signed
}

/**
 * Checks if the user has already marked a nostr event as read
 * @param eventId The ID of the event to check
 * @param userPubkey The user's pubkey
 * @param relayPool The relay pool for querying
 * @returns True if the user has already reacted with the mark-as-read emoji
 */
export async function hasMarkedEventAsRead(
  eventId: string,
  userPubkey: string,
  relayPool: RelayPool
): Promise<boolean> {
  try {
    const filter = {
      kinds: [7],
      authors: [userPubkey],
      '#e': [eventId]
    }

    const events$ = relayPool
      .req(RELAYS, filter)
      .pipe(
        onlyEvents(),
        completeOnEose(),
        takeUntil(timer(2000)),
        toArray()
      )

    const events: NostrEvent[] = await lastValueFrom(events$)
    
    // Check if any reaction has our mark-as-read emoji
    const hasReadReaction = events.some((event: NostrEvent) => event.content === MARK_AS_READ_EMOJI)
    
    return hasReadReaction
  } catch (error) {
    console.error('Error checking read status:', error)
    return false
  }
}

/**
 * Checks if the user has already marked a website as read
 * @param url The URL to check
 * @param userPubkey The user's pubkey
 * @param relayPool The relay pool for querying
 * @returns True if the user has already reacted with the mark-as-read emoji
 */
export async function hasMarkedWebsiteAsRead(
  url: string,
  userPubkey: string,
  relayPool: RelayPool
): Promise<boolean> {
  try {
    // Normalize URL the same way as when creating reactions
    let normalizedUrl = url
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      normalizedUrl = parsed.toString()
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1)
      }
    } catch (error) {
      console.warn('Failed to normalize URL:', error)
    }

    const filter = {
      kinds: [17],
      authors: [userPubkey],
      '#r': [normalizedUrl]
    }

    const events$ = relayPool
      .req(RELAYS, filter)
      .pipe(
        onlyEvents(),
        completeOnEose(),
        takeUntil(timer(2000)),
        toArray()
      )

    const events: NostrEvent[] = await lastValueFrom(events$)
    
    // Check if any reaction has our mark-as-read emoji
    const hasReadReaction = events.some((event: NostrEvent) => event.content === MARK_AS_READ_EMOJI)
    
    return hasReadReaction
  } catch (error) {
    console.error('Error checking read status:', error)
    return false
  }
}

