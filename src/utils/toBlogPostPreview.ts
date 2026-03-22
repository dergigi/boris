import { NostrEvent } from 'nostr-tools'
import { getArticleImage, getArticlePublished, getArticleSummary, getArticleTitle } from 'applesauce-common/helpers'
import { BlogPostPreview } from '../services/exploreService'

export const toBlogPostPreview = (event: NostrEvent): BlogPostPreview => {
  const meta = getArticleMeta(event)
  return {
    event,
    ...meta,
    title: meta.title || 'Untitled'
  }
}

/**
 * Extract article metadata from a NostrEvent.
 * Returns raw values without fallbacks -- callers apply their own defaults.
 */
export function getArticleMeta(event: NostrEvent) {
  return {
    title: getArticleTitle(event) || undefined,
    summary: getArticleSummary(event),
    image: getArticleImage(event),
    published: getArticlePublished(event),
    author: event.pubkey
  }
}

