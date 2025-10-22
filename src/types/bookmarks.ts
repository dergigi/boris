export interface ParsedNode {
  type: string
  value?: string
  url?: string
  encoded?: string
  children?: ParsedNode[]
}

export interface ParsedContent {
  type: string
  children: ParsedNode[]
}

export interface Bookmark {
  id: string
  title: string
  url: string
  content: string
  created_at: number
  tags: string[][]
  bookmarkCount?: number
  eventReferences?: string[]
  articleReferences?: string[]
  urlReferences?: string[]
  parsedContent?: ParsedContent
  individualBookmarks?: IndividualBookmark[]
  isPrivate?: boolean
  encryptedContent?: string
}

export interface IndividualBookmark {
  id: string
  content: string
  // Timestamp when the content was created (from the content event itself)
  created_at: number
  pubkey: string
  kind: number
  tags: string[][]
  parsedContent?: ParsedContent
  author?: string
  type: 'event' | 'article' | 'web'
  isPrivate?: boolean
  encryptedContent?: string
  // The kind of the source list/set that produced this bookmark (e.g., 10003, 30003, 30001, or 39701 for web)
  sourceKind?: number
  // The 'd' tag value from kind 30003 bookmark sets
  setName?: string
  // Metadata from the bookmark set event (kind 30003)
  setTitle?: string
  setDescription?: string
  setImage?: string
  // Timestamp of the bookmark list event (best proxy for "when bookmarked")
  // Note: This is imperfect - it's when the list was last updated, not necessarily when this item was added
  listUpdatedAt?: number
}

export interface ActiveAccount {
  pubkey: string
}
