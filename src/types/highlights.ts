// NIP-84 Highlight types
export interface Highlight {
  id: string
  pubkey: string
  created_at: number
  content: string // The highlighted text
  tags: string[][]
  // Extracted tag values
  eventReference?: string // 'e' or 'a' tag
  urlReference?: string // 'r' tag
  author?: string // 'p' tag with 'author' role
  context?: string // surrounding text context
}

