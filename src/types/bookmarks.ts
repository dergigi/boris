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
  created_at: number
  pubkey: string
  kind: number
  tags: string[][]
  parsedContent?: ParsedContent
  author?: string
  type: 'event' | 'article' | 'web'
  isPrivate?: boolean
  encryptedContent?: string
  // When the item was added to the bookmark list (synthetic, for sorting)
  added_at?: number
  // The kind of the source list/set that produced this bookmark (e.g., 10003, 30003, 30001, or 39701 for web)
  sourceKind?: number
}

export interface ActiveAccount {
  pubkey: string
}
