import React from 'react'
import { decode, npubEncode, noteEncode } from 'nostr-tools/nip19'
import { DecodeResult } from 'nostr-tools/nip19'

/**
 * Regular expression to match nostr: URIs and bare NIP-19 identifiers
 * Matches: nostr:npub1..., nostr:note1..., nostr:nprofile1..., nostr:nevent1..., nostr:naddr1...
 * Also matches bare identifiers without the nostr: prefix
 */
const NOSTR_URI_REGEX = /(?:nostr:)?((npub|note|nprofile|nevent|naddr)1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58,})/gi

/**
 * Extract all nostr URIs from text
 */
export function extractNostrUris(text: string): string[] {
  const matches = text.match(NOSTR_URI_REGEX)
  if (!matches) return []
  
  // Extract just the NIP-19 identifier (without nostr: prefix)
  return matches.map(match => {
    const cleanMatch = match.replace(/^nostr:/, '')
    return cleanMatch
  })
}

/**
 * Extract all naddr (article) identifiers from text
 */
export function extractNaddrUris(text: string): string[] {
  const allUris = extractNostrUris(text)
  return allUris.filter(uri => {
    try {
      const decoded = decode(uri)
      return decoded.type === 'naddr'
    } catch {
      return false
    }
  })
}

/**
 * Decode a NIP-19 identifier and return a human-readable link
 * For articles (naddr), returns an internal app link
 * For other types, returns an external njump.me link
 */
export function createNostrLink(encoded: string): string {
  try {
    const decoded = decode(encoded)
    
    switch (decoded.type) {
      case 'naddr':
        // For articles, link to our internal app route
        return `/a/${encoded}`
      case 'npub':
      case 'nprofile':
      case 'note':
      case 'nevent':
        return `https://njump.me/${encoded}`
      default:
        return `https://njump.me/${encoded}`
    }
  } catch (error) {
    console.warn('Failed to decode nostr URI:', encoded, error)
    return `https://njump.me/${encoded}`
  }
}

/**
 * Get a display label for a nostr URI
 */
export function getNostrUriLabel(encoded: string): string {
  try {
    const decoded = decode(encoded)
    
    switch (decoded.type) {
      case 'npub':
        return `@${encoded.slice(0, 12)}...`
      case 'nprofile':
        const npub = npubEncode(decoded.data.pubkey)
        return `@${npub.slice(0, 12)}...`
      case 'note':
        return `note:${encoded.slice(5, 12)}...`
      case 'nevent':
        const note = noteEncode(decoded.data.id)
        return `note:${note.slice(5, 12)}...`
      case 'naddr':
        // For articles, show the identifier if available
        const identifier = decoded.data.identifier
        if (identifier && identifier.length > 0) {
          // Truncate long identifiers but keep them readable
          return identifier.length > 40 ? `${identifier.slice(0, 37)}...` : identifier
        }
        return 'nostr article'
      default:
        return encoded.slice(0, 16) + '...'
    }
  } catch (error) {
    return encoded.slice(0, 16) + '...'
  }
}

/**
 * Replace nostr: URIs in markdown with proper markdown links
 * This converts: nostr:npub1... to [label](link)
 */
export function replaceNostrUrisInMarkdown(markdown: string): string {
  return markdown.replace(NOSTR_URI_REGEX, (match) => {
    // Extract just the NIP-19 identifier (without nostr: prefix)
    const encoded = match.replace(/^nostr:/, '')
    const link = createNostrLink(encoded)
    const label = getNostrUriLabel(encoded)
    
    return `[${label}](${link})`
  })
}

/**
 * Replace nostr: URIs in markdown with proper markdown links, using resolved titles for articles
 * This converts: nostr:naddr1... to [Article Title](link)
 * @param markdown The markdown content to process
 * @param articleTitles Map of naddr -> title for resolved articles
 */
export function replaceNostrUrisInMarkdownWithTitles(
  markdown: string, 
  articleTitles: Map<string, string>
): string {
  return markdown.replace(NOSTR_URI_REGEX, (match) => {
    // Extract just the NIP-19 identifier (without nostr: prefix)
    const encoded = match.replace(/^nostr:/, '')
    const link = createNostrLink(encoded)
    
    // For articles, use the resolved title if available
    try {
      const decoded = decode(encoded)
      if (decoded.type === 'naddr' && articleTitles.has(encoded)) {
        const title = articleTitles.get(encoded)!
        return `[${title}](${link})`
      }
    } catch (error) {
      // Ignore decode errors, fall through to default label
    }
    
    // For other types or if title not resolved, use default label
    const label = getNostrUriLabel(encoded)
    return `[${label}](${link})`
  })
}

/**
 * Replace nostr: URIs in HTML with clickable links
 * This is used when processing HTML content directly
 */
export function replaceNostrUrisInHTML(html: string): string {
  return html.replace(NOSTR_URI_REGEX, (match) => {
    // Extract just the NIP-19 identifier (without nostr: prefix)
    const encoded = match.replace(/^nostr:/, '')
    const link = createNostrLink(encoded)
    const label = getNostrUriLabel(encoded)
    
    return `<a href="${link}" class="nostr-uri-link" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
}

/**
 * Get decoded information from a nostr URI for detailed display
 */
export function getNostrUriInfo(encoded: string): {
  type: string
  decoded: DecodeResult | null
  link: string
  label: string
} {
  let decoded: DecodeResult | null = null
  try {
    decoded = decode(encoded)
  } catch (error) {
    // ignore decoding errors
  }
  
  return {
    type: decoded?.type || 'unknown',
    decoded,
    link: createNostrLink(encoded),
    label: getNostrUriLabel(encoded)
  }
}

