import { EventFactory } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'

/**
 * Creates a web bookmark event (NIP-B0, kind:39701)
 * @param url The URL to bookmark
 * @param title Optional title for the bookmark
 * @param description Optional description
 * @param account The user's account for signing
 * @param relayPool The relay pool for publishing
 * @param relays The relays to publish to
 * @returns The signed event
 */
export async function createWebBookmark(
  url: string,
  title: string | undefined,
  description: string | undefined,
  account: IAccount,
  relayPool: RelayPool,
  relays: string[]
): Promise<NostrEvent> {
  if (!url || !url.trim()) {
    throw new Error('URL is required for web bookmark')
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  const factory = new EventFactory({ signer: account })

  // Build tags according to NIP-B0
  const tags: string[][] = [
    ['d', url], // URL as identifier
  ]

  if (title) {
    tags.push(['title', title])
  }

  if (description) {
    tags.push(['summary', description])
  }

  // Create the event
  const draft = await factory.create(async () => ({
    kind: 39701, // NIP-B0 web bookmark
    content: '',
    tags,
    created_at: Math.floor(Date.now() / 1000)
  }))

  // Sign the event
  const signedEvent = await factory.sign(draft)

  // Publish to relays
  await relayPool.publish(relays, signedEvent)

  console.log('✅ Web bookmark published:', signedEvent)

  return signedEvent
}

