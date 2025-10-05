import { EventFactory } from 'applesauce-factory'
import { HighlightBlueprint } from 'applesauce-factory/blueprints'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { WRITE_RELAYS } from '../config/relays'

/**
 * Creates and publishes a highlight event (NIP-84)
 */
export async function createHighlight(
  selectedText: string,
  article: NostrEvent | null,
  account: IAccount,
  relayPool: RelayPool,
  comment?: string
): Promise<void> {
  if (!selectedText || !article) {
    throw new Error('Missing required data to create highlight')
  }

  // Create EventFactory with the account as signer
  const factory = new EventFactory({ signer: account })

  // Parse article coordinate to get address pointer
  const addressPointer = parseArticleCoordinate(article)

  // Create highlight event using the blueprint
  const highlightEvent = await factory.create(
    HighlightBlueprint,
    selectedText,
    addressPointer,
    comment ? { comment } : undefined
  )

  // Sign the event
  const signedEvent = await factory.sign(highlightEvent)

  // Publish to relays (including local relay)
  await relayPool.publish(WRITE_RELAYS, signedEvent)
  
  console.log('✅ Highlight published to', WRITE_RELAYS.length, 'relays (including local):', signedEvent)
}

/**
 * Parse article coordinate to create address pointer
 */
function parseArticleCoordinate(article: NostrEvent): AddressPointer {
  // Try to get identifier from article tags
  const identifier = article.tags.find(tag => tag[0] === 'd')?.[1] || ''

  return {
    kind: article.kind,
    pubkey: article.pubkey,
    identifier,
    relays: [] // Optional relays hint
  }
}

