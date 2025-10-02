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
  type: 'event' | 'article'
}

export interface ActiveAccount {
  pubkey: string
}
