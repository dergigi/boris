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
  console.log('[nostrUriResolver] ===== STARTING MARKDOWN PROCESSING =====')
  console.log('[nostrUriResolver] Input markdown length:', markdown.length)
  console.log('[nostrUriResolver] Input markdown preview (first 500 chars):', markdown.slice(0, 500))
  
  // Check if input already contains markdown links (could indicate double-processing)
  const existingLinkCount = (markdown.match(/\]\(/g) || []).length
  console.log('[nostrUriResolver] Existing markdown links in input:', existingLinkCount)
  
  // Track positions where we're inside a markdown link URL
  // Use a parser approach to correctly handle URLs with brackets/parentheses
  const linkRanges: Array<{ start: number, end: number }> = []
  
  // Find all markdown link URLs by looking for ]( pattern and tracking to matching )
  let i = 0
  let linksFound = 0
  while (i < markdown.length) {
    // Look for ]( pattern that starts a markdown link URL
    const urlStartMatch = markdown.indexOf('](', i)
    if (urlStartMatch === -1) break
    
    linksFound++
    const urlStart = urlStartMatch + 2 // Position after "]("
    
    // Check what comes before ]( to see if it's actually a markdown link
    const beforeMatch = markdown.slice(Math.max(0, urlStartMatch - 50), urlStartMatch)
    console.log('[nostrUriResolver] Found ]( at position', urlStartMatch, 'context before:', beforeMatch)
    
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
      console.log('[nostrUriResolver] Link #' + linksFound + ' - URL at', urlStart, '-', urlEnd, 'content:', urlContent.slice(0, 150))
      
      // Check if this URL contains nostr URIs
      const containsNostrUri = /(?:nostr:)?(npub|note|nprofile|nevent|naddr)1/i.test(urlContent)
      if (containsNostrUri) {
        console.warn('[nostrUriResolver] ⚠️ WARNING: Link URL contains nostr URI! This should be protected:', urlContent.slice(0, 200))
      }
      
      linkRanges.push({
        start: urlStart,
        end: urlEnd
      })
      
      i = urlEnd + 1
    } else {
      console.warn('[nostrUriResolver] ⚠️ Could not find matching ) for ]( at position', urlStartMatch)
      // No matching closing paren found, skip this one
      i = urlStart + 1
    }
  }
  
  console.log('[nostrUriResolver] Total markdown links found:', linksFound)
  console.log('[nostrUriResolver] Total link URL ranges tracked:', linkRanges.length)
  if (linkRanges.length > 0) {
    console.log('[nostrUriResolver] Link ranges:', linkRanges.map(r => `${r.start}-${r.end}`).join(', '))
  }
  
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
  // Also check if nostr URI is part of any URL pattern (http/https URLs)
  // Callback params: (match, encoded, type, offset, string)
  let nostrMatchCount = 0
  const result = markdown.replace(NOSTR_URI_REGEX, (match, encoded, _type, offset, fullString) => {
    nostrMatchCount++
    const matchEnd = offset + match.length
    console.log('[nostrUriResolver] Found nostr URI match #' + nostrMatchCount)
    console.log('[nostrUriResolver]   - Match:', match)
    console.log('[nostrUriResolver]   - Encoded:', encoded)
    console.log('[nostrUriResolver]   - Position:', offset, 'to', matchEnd)
    console.log('[nostrUriResolver]   - Context around match:', fullString.slice(Math.max(0, offset - 50), matchEnd + 50))
    
    // Check if this match is inside a markdown link URL
    // Check both start and end positions to ensure we catch the whole match
    const startInside = isInsideLinkUrl(offset)
    const endInside = isInsideLinkUrl(matchEnd - 1) // Check end position
    
    if (startInside || endInside) {
      const range = linkRanges.find(r => 
        (offset >= r.start && offset < r.end) || 
        (matchEnd - 1 >= r.start && matchEnd - 1 < r.end)
      )
      console.log('[nostrUriResolver] SKIPPING replacement - inside markdown link URL')
      console.log('[nostrUriResolver]   - Match range:', offset, 'to', matchEnd)
      console.log('[nostrUriResolver]   - Link URL range:', range)
      console.log('[nostrUriResolver]   - Link URL content:', range ? markdown.slice(range.start, range.end).slice(0, 200) : 'N/A')
      // Don't replace - return original match
      return match
    }
    
    // Also check if the nostr URI is part of an HTTP/HTTPS URL pattern
    // This catches cases where the source markdown has URLs like https://example.com/naddr1...
    // before they're formatted as markdown links
    const contextBefore = fullString.slice(Math.max(0, offset - 200), offset)
    const contextAfter = fullString.slice(matchEnd, Math.min(fullString.length, matchEnd + 10))
    
    // Check if we're inside an http/https URL (looking for https?:// pattern before the match)
    // and the match is followed by valid URL characters (not whitespace or closing paren)
    const urlPatternBefore = /https?:\/\/[^\s)]*$/i
    const isInHttpUrl = urlPatternBefore.test(contextBefore)
    const isValidUrlContinuation = !contextAfter.match(/^[\s)]/) // Not followed by space or closing paren
    
    if (isInHttpUrl && isValidUrlContinuation) {
      console.log('[nostrUriResolver] SKIPPING replacement - appears to be part of HTTP URL')
      console.log('[nostrUriResolver]   - Context before:', contextBefore.slice(-80))
      console.log('[nostrUriResolver]   - Context after:', contextAfter)
      // Don't replace - return original match
      return match
    }
    
    console.log('[nostrUriResolver] REPLACING nostr URI (NOT inside any link URL or HTTP URL)')
    // encoded is already the NIP-19 identifier without nostr: prefix (from capture group)
    const replacement = getReplacement(encoded)
    console.log('[nostrUriResolver]   - Replacement:', replacement)
    return replacement
  })
  
  console.log('[nostrUriResolver] Processing complete. Total nostr matches:', nostrMatchCount)
  console.log('[nostrUriResolver] Result length:', result.length)
  console.log('[nostrUriResolver] Result preview:', result.slice(0, 500))
  
  // Check if we created nested markdown links (this would indicate a problem)
  const nestedLinkPattern = /\]\([^)]*\[[^\]]+\]\([^)]+\)[^)]*\)/g
  const nestedLinks = result.match(nestedLinkPattern)
  if (nestedLinks && nestedLinks.length > 0) {
    console.error('[nostrUriResolver] ⚠️⚠️⚠️ ERROR: Created nested markdown links! This indicates a bug:', nestedLinks.slice(0, 3))
  }
  
  console.log('[nostrUriResolver] ===== MARKDOWN PROCESSING COMPLETE =====')
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

