// NIP-84 Highlight types
export type HighlightLevel = 'nostrverse' | 'friends' | 'mine'

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
  comment?: string // optional comment about the highlight
  // Level classification (computed based on user's context)
  level?: HighlightLevel
  // Relay tracking for offline/local-only highlights
  publishedRelays?: string[] // URLs of relays that acknowledged this event
  isLocalOnly?: boolean // true if only published to local relays
  isOfflineCreated?: boolean // true if created while in flight mode (offline)
  isSyncing?: boolean // true if currently being synced to remote relays
}

