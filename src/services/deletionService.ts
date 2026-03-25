import { EventFactory } from 'applesauce-core/event-factory'
import { setDeleteEvents } from 'applesauce-core/operations/delete'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { RELAYS } from '../config/relays'

/**
 * Creates and publishes a NIP-09 deletion request using applesauce's
 * `setDeleteEvents` operation for correct tag construction.
 *
 * @param eventId The ID of the event to delete
 * @param _eventKind Unused (kept for API compatibility)
 * @param reason Optional reason for deletion
 * @param account The user's account for signing
 * @param relayPool The relay pool for publishing
 * @returns The signed deletion request event
 */
export async function createDeletionRequest(
  eventId: string,
  _eventKind: number,
  reason: string | undefined,
  account: IAccount,
  relayPool: RelayPool
): Promise<NostrEvent> {
  const factory = new EventFactory({ signer: account })

  const draft = await factory.build(
    { kind: 5, content: reason || '' },
    setDeleteEvents([eventId])
  )

  const signed = await factory.sign(draft)

  await relayPool.publish(RELAYS, signed)

  return signed
}
