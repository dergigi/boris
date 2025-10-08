import { EventFactory } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'

/**
 * Creates a web bookmark event (NIP-B0, kind:39701)
 * @param url The URL to bookmark
 * @param title Optional title for the bookmark
 * @param description Optional description (goes in content field)
 * @param bookmarkTags Optional array of tags/hashtags
 * @param account The user's account for signing
 * @param relayPool The relay pool for publishing
 * @param relays The relays to publish to
 * @returns The signed event
 */
export async function createWebBookmark(
  url: string,
  title: string | undefined,
  description: string | undefined,
  bookmarkTags: string[] | undefined,
  account: IAccount,
  relayPool: RelayPool,
  relays: string[]
): Promise<NostrEvent> {
  if (!url || !url.trim()) {
    throw new Error('URL is required for web bookmark')
  }

  // Validate URL format and extract the URL without scheme for d tag
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  // d tag should be URL without scheme (as per NIP-B0)
  const dTagValue = parsedUrl.host + parsedUrl.pathname + parsedUrl.search + parsedUrl.hash

  const factory = new EventFactory({ signer: account })
  const now = Math.floor(Date.now() / 1000)

  // Build tags according to NIP-B0
  const tags: string[][] = [
    ['d', dTagValue], // URL without scheme as identifier
  ]

  // Add published_at tag (current timestamp)
  tags.push(['published_at', now.toString()])

  // Add title tag if provided
  if (title && title.trim()) {
    tags.push(['title', title.trim()])
  }

  // Add t tags for each bookmark tag/hashtag
  if (bookmarkTags && bookmarkTags.length > 0) {
    bookmarkTags.forEach(tag => {
      const trimmedTag = tag.trim()
      if (trimmedTag) {
        tags.push(['t', trimmedTag])
      }
    })
  }

  // Create the event with description in content field (as per NIP-B0)
  const draft = await factory.create(async () => ({
    kind: 39701, // NIP-B0 web bookmark
    content: description?.trim() || '',
    tags,
    created_at: now
  }))

  // Sign the event
  const signedEvent = await factory.sign(draft)

  // Publish to relays in the background (don't block UI)
  relayPool.publish(relays, signedEvent)
    .then(() => {
      console.log('✅ Web bookmark published to', relays.length, 'relays:', signedEvent)
    })
    .catch((err) => {
      console.warn('⚠️ Some relays failed to publish bookmark:', err)
    })

  // Return immediately so UI doesn't block
  return signedEvent
}

