import { NostrEvent } from 'nostr-tools'
import { getArticleImage, getArticlePublished, getArticleSummary, getArticleTitle } from 'applesauce-common/helpers'
import { BlogPostPreview } from '../services/exploreService'

export const toBlogPostPreview = (event: NostrEvent): BlogPostPreview => ({
  event,
  title: getArticleTitle(event) || 'Untitled',
  summary: getArticleSummary(event),
  image: getArticleImage(event),
  published: getArticlePublished(event),
  author: event.pubkey
})

