// Nostr event kinds used throughout the application
export const KINDS = {
  Highlights: 9802,              // NIP-?? user highlights
  BlogPost: 30023,               // NIP-23 long-form article
  AppData: 30078,                // NIP-78 application data (reading positions)
  List: 30001,                   // NIP-51 list (addressable)
  ListReplaceable: 30003,        // NIP-51 replaceable list
  ListSimple: 10003,             // NIP-51 simple list
  WebBookmark: 39701,            // NIP-B0 web bookmark
  ReactionToEvent: 7,            // emoji reaction to event (used for mark-as-read)
  ReactionToUrl: 17              // emoji reaction to URL (used for mark-as-read)
} as const

export type KindValue = typeof KINDS[keyof typeof KINDS]

