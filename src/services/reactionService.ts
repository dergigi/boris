import { EventFactory } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { RELAYS } from '../config/relays'

const MARK_AS_READ_EMOJI = '📚'

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

  console.log('📚 Created kind:7 reaction (mark as read) for event:', eventId.slice(0, 8))

  // Publish to relays
  await relayPool.publish(RELAYS, signed)

  console.log('✅ Reaction published to', RELAYS.length, 'relay(s)')

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

  console.log('📚 Created kind:17 reaction (mark as read) for URL:', normalizedUrl)

  // Publish to relays
  await relayPool.publish(RELAYS, signed)

  console.log('✅ Website reaction published to', RELAYS.length, 'relay(s)')

  return signed
}

