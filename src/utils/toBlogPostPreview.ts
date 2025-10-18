import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { BlogPostPreview } from '../services/exploreService'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

export const toBlogPostPreview = (event: NostrEvent): BlogPostPreview => ({
  event,
  title: getArticleTitle(event) || 'Untitled',
  summary: getArticleSummary(event),
  image: getArticleImage(event),
  published: getArticlePublished(event),
  author: event.pubkey
})

