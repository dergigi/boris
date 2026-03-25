import { EventFactory } from 'applesauce-core/event-factory'
import 'applesauce-common/blueprints/delete'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { getActiveRelayUrls } from './relayManager'
import { isLocalRelay, areAllRelaysLocal } from '../utils/helpers'
import { markEventAsOfflineCreated } from './offlineSyncService'

/**
 * Creates a kind:5 event deletion request (NIP-09) using applesauce DeleteBlueprint.
 * Queues the deletion for later sync when only local relays are available.
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

  const draft = await factory.delete([eventId], reason)
  const signed = await factory.sign(draft)

  const connectedRelays = Array.from(relayPool.relays.values())
    .filter(relay => relay.connected)
    .map(relay => relay.url)

  const hasRemoteConnection = connectedRelays.some(url => !isLocalRelay(url))
  const activeRelays = getActiveRelayUrls(relayPool)
  const expectedSuccessRelays = hasRemoteConnection
    ? activeRelays
    : activeRelays.filter(isLocalRelay)

  const isLocalOnly = areAllRelaysLocal(expectedSuccessRelays)

  if (isLocalOnly) {
    markEventAsOfflineCreated(signed.id)
  }

  await relayPool.publish(activeRelays, signed)

  return signed
}
