import { EventFactory } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { RELAYS } from '../config/relays'

/**
 * Creates a kind:5 event deletion request (NIP-09)
 * @param eventId The ID of the event to delete
 * @param eventKind The kind of the event being deleted
 * @param reason Optional reason for deletion
 * @param account The user's account for signing
 * @param relayPool The relay pool for publishing
 * @returns The signed deletion request event
 */
export async function createDeletionRequest(
  eventId: string,
  eventKind: number,
  reason: string | undefined,
  account: IAccount,
  relayPool: RelayPool
): Promise<NostrEvent> {
  const factory = new EventFactory({ signer: account })

  const tags: string[][] = [
    ['e', eventId],
    ['k', eventKind.toString()]
  ]

  const draft = await factory.create(async () => ({
    kind: 5, // Event Deletion Request
    content: reason || '',
    tags,
    created_at: Math.floor(Date.now() / 1000)
  }))

  const signed = await factory.sign(draft)

  console.log('🗑️ Created kind:5 deletion request for event:', eventId.slice(0, 8))

  // Publish to relays
  await relayPool.publish(RELAYS, signed)

  console.log('✅ Deletion request published to', RELAYS.length, 'relay(s)')

  return signed
}

