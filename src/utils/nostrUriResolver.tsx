import { decode, npubEncode, noteEncode } from 'nostr-tools/nip19'
import { getNostrUrl } from '../config/nostrGateways'

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
 * For articles (naddr) and profiles (npub/nprofile), returns internal app links
 * For other types, returns an external gateway link
 */
export function createNostrLink(encoded: string): string {
  try {
    const decoded = decode(encoded)
    
    switch (decoded.type) {
      case 'naddr':
        // For articles, link to our internal app route
        return `/a/${encoded}`
      case 'npub':
        // For profiles, link to our internal app route
        return `/p/${encoded}`
      case 'nprofile': {
        // For nprofile, convert to npub and link to our internal app route
        const npub = npubEncode(decoded.data.pubkey)
        return `/p/${npub}`
      }
      case 'note':
      case 'nevent':
        return getNostrUrl(encoded)
      default:
        return getNostrUrl(encoded)
    }
  } catch (error) {
    console.warn('Failed to decode nostr URI:', encoded, error)
    return getNostrUrl(encoded)
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
      case 'nprofile': {
        const npub = npubEncode(decoded.data.pubkey)
        return `@${npub.slice(0, 12)}...`
      }
      case 'note':
        return `note:${encoded.slice(5, 12)}...`
      case 'nevent': {
        const note = noteEncode(decoded.data.id)
        return `note:${note.slice(5, 12)}...`
      }
      case 'naddr': {
        // For articles, show the identifier if available
        const identifier = decoded.data.identifier
        if (identifier && identifier.length > 0) {
          // Truncate long identifiers but keep them readable
          return identifier.length > 40 ? `${identifier.slice(0, 37)}...` : identifier
        }
        return 'nostr article'
      }
      default:
        return encoded.slice(0, 16) + '...'
    }
  } catch (error) {
    return encoded.slice(0, 16) + '...'
  }
}

/**
 * Process markdown to replace nostr URIs while skipping those inside markdown links
 * This prevents nested markdown link issues when nostr identifiers appear in URLs
 */
function replaceNostrUrisSafely(
  markdown: string,
  getReplacement: (encoded: string) => string
): string {
  console.log('[nostrUriResolver] Starting markdown processing, length:', markdown.length)
  
  // Track positions where we're inside a markdown link URL
  // Use a parser approach to correctly handle URLs with brackets/parentheses
  const linkRanges: Array<{ start: number, end: number }> = []
  
  // Find all markdown link URLs by looking for ]( pattern and tracking to matching )
  let i = 0
  while (i < markdown.length) {
    // Look for ]( pattern that starts a markdown link URL
    const urlStartMatch = markdown.indexOf('](', i)
    if (urlStartMatch === -1) break
    
    const urlStart = urlStartMatch + 2 // Position after "]("
    
    // Now find the matching closing parenthesis
    // We need to account for nested parentheses and escaped characters
    let pos = urlStart
    let depth = 1 // We're inside one set of parentheses
    let urlEnd = -1
    
    while (pos < markdown.length && depth > 0) {
      const char = markdown[pos]
      const nextChar = pos + 1 < markdown.length ? markdown[pos + 1] : ''
      
      // Check for escaped characters
      if (char === '\\' && nextChar) {
        pos += 2 // Skip escaped character
        continue
      }
      
      if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
        if (depth === 0) {
          urlEnd = pos
          break
        }
      }
      
      pos++
    }
    
    if (urlEnd !== -1) {
      const urlContent = markdown.slice(urlStart, urlEnd)
      console.log('[nostrUriResolver] Found markdown link URL at', urlStart, '-', urlEnd, 'content:', urlContent.slice(0, 100))
      
      linkRanges.push({
        start: urlStart,
        end: urlEnd
      })
      
      i = urlEnd + 1
    } else {
      // No matching closing paren found, skip this one
      i = urlStart + 1
    }
  }
  
  console.log('[nostrUriResolver] Total link ranges tracked:', linkRanges.length)
  
  // Check if a position is inside any markdown link URL
  const isInsideLinkUrl = (pos: number): boolean => {
    const inside = linkRanges.some(range => pos >= range.start && pos < range.end)
    if (inside) {
      const matchingRange = linkRanges.find(range => pos >= range.start && pos < range.end)
      console.log('[nostrUriResolver] Position', pos, 'is inside link URL range', matchingRange)
    }
    return inside
  }
  
  // Replace nostr URIs, but skip those inside link URLs
  // Callback params: (match, encoded, type, offset, string)
  let nostrMatchCount = 0
  const result = markdown.replace(NOSTR_URI_REGEX, (match, encoded, _type, offset) => {
    nostrMatchCount++
    console.log('[nostrUriResolver] Found nostr URI match #' + nostrMatchCount + ' at offset', offset + ':', match, 'encoded:', encoded)
    
    // Check if this match is inside a markdown link URL
    if (isInsideLinkUrl(offset)) {
      console.log('[nostrUriResolver] SKIPPING replacement - inside link URL')
      // Don't replace - return original match
      return match
    }
    
    console.log('[nostrUriResolver] REPLACING nostr URI')
    // encoded is already the NIP-19 identifier without nostr: prefix (from capture group)
    const replacement = getReplacement(encoded)
    console.log('[nostrUriResolver] Replacement:', replacement)
    return replacement
  })
  
  console.log('[nostrUriResolver] Processing complete. Total nostr matches:', nostrMatchCount)
  console.log('[nostrUriResolver] Result length:', result.length)
  console.log('[nostrUriResolver] Result preview:', result.slice(0, 500))
  
  return result
}

/**
 * Replace nostr: URIs in markdown with proper markdown links
 * This converts: nostr:npub1... to [label](link)
 */
export function replaceNostrUrisInMarkdown(markdown: string): string {
  console.log('[nostrUriResolver] replaceNostrUrisInMarkdown called')
  return replaceNostrUrisSafely(markdown, (encoded) => {
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
  console.log('[nostrUriResolver] replaceNostrUrisInMarkdownWithTitles called, articleTitles:', articleTitles.size)
  return replaceNostrUrisSafely(markdown, (encoded) => {
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
  decoded: ReturnType<typeof decode> | null
  link: string
  label: string
} {
  let decoded: ReturnType<typeof decode> | null = null
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

