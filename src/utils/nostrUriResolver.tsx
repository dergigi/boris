import { decode, npubEncode, noteEncode } from 'nostr-tools/nip19'
import { getNostrUrl } from '../config/nostrGateways'
import { Tokens } from 'applesauce-content/helpers'
import { getContentPointers } from 'applesauce-factory/helpers'
import { encodeDecodeResult } from 'applesauce-core/helpers'

/**
 * Regular expression to match nostr: URIs and bare NIP-19 identifiers
 * Uses applesauce Tokens.nostrLink which includes word boundary checks
 * Matches: nostr:npub1..., nostr:note1..., nostr:nprofile1..., nostr:nevent1..., nostr:naddr1...
 * Also matches bare identifiers without the nostr: prefix
 */
const NOSTR_URI_REGEX = Tokens.nostrLink

/**
 * Extract all nostr URIs from text using applesauce helpers
 */
export function extractNostrUris(text: string): string[] {
  try {
    const pointers = getContentPointers(text)
    const result: string[] = []
    pointers.forEach(pointer => {
      try {
        const encoded = encodeDecodeResult(pointer)
        if (encoded) {
          result.push(encoded)
        }
      } catch {
        // Ignore encoding errors, continue processing other pointers
      }
    })
    return result
  } catch {
    return []
  }
}

/**
 * Extract all naddr (article) identifiers from text using applesauce helpers
 */
export function extractNaddrUris(text: string): string[] {
  const pointers = getContentPointers(text)
  return pointers
    .filter(pointer => pointer.type === 'naddr')
    .map(pointer => encodeDecodeResult(pointer))
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
        // Remove "npub1" prefix (5 chars) and show next 7 chars
        return `@${encoded.slice(5, 12)}...`
      case 'nprofile': {
        const npub = npubEncode(decoded.data.pubkey)
        // Remove "npub1" prefix (5 chars) and show next 7 chars
        return `@${npub.slice(5, 12)}...`
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
 * Get a standardized fallback display name for a pubkey when profile has no name
 * Returns npub format: @abc1234...
 * @param pubkey The pubkey in hex format
 * @returns Formatted npub display string
 */
export function getNpubFallbackDisplay(pubkey: string): string {
  try {
    const npub = npubEncode(pubkey)
    // Remove "npub1" prefix (5 chars) and show next 7 chars
    return `@${npub.slice(5, 12)}...`
  } catch {
    // Fallback to shortened pubkey if encoding fails
    return `@${pubkey.slice(0, 8)}...`
  }
}

/**
 * Get display name for a profile with consistent priority order
 * Returns: profile.name || profile.display_name || profile.nip05 || npub fallback
 * This function works with parsed profile objects (from useEventModel)
 * For NostrEvent objects, use extractProfileDisplayName from profileUtils
 * @param profile Profile object with optional name, display_name, and nip05 fields
 * @param pubkey The pubkey in hex format (required for fallback)
 * @returns Display name string
 */
export function getProfileDisplayName(
  profile: { name?: string; display_name?: string; nip05?: string } | null | undefined,
  pubkey: string
): string {
  // Consistent priority order: name || display_name || nip05 || fallback
  if (profile?.name) return profile.name
  if (profile?.display_name) return profile.display_name
  if (profile?.nip05) return profile.nip05
  return getNpubFallbackDisplay(pubkey)
}

/**
 * Process markdown to replace nostr URIs while skipping those inside markdown links
 * This prevents nested markdown link issues when nostr identifiers appear in URLs
 */
function replaceNostrUrisSafely(
  markdown: string,
  getReplacement: (encoded: string) => string
): string {
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
  
  // Check if a position is inside any markdown link URL
  const isInsideLinkUrl = (pos: number): boolean => {
    return linkRanges.some(range => pos >= range.start && pos < range.end)
  }
  
  // Replace nostr URIs, but skip those inside link URLs
  // Also check if nostr URI is part of any URL pattern (http/https URLs)
  // Callback params: (match, encoded, type, offset, string)
  const result = markdown.replace(NOSTR_URI_REGEX, (match, encoded, _type, offset, fullString) => {
    const matchEnd = offset + match.length
    
    // Check if this match is inside a markdown link URL
    // Check both start and end positions to ensure we catch the whole match
    const startInside = isInsideLinkUrl(offset)
    const endInside = isInsideLinkUrl(matchEnd - 1) // Check end position
    
    if (startInside || endInside) {
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
      // Don't replace - return original match
      return match
    }
    
    // encoded is already the NIP-19 identifier without nostr: prefix (from capture group)
    const replacement = getReplacement(encoded)
    return replacement
  })
  
  return result
}

/**
 * Replace nostr: URIs in markdown with proper markdown links
 * This converts: nostr:npub1... to [label](link)
 */
export function replaceNostrUrisInMarkdown(markdown: string): string {
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
 * Replace nostr: URIs in markdown with proper markdown links, using resolved profile names and article titles
 * This converts: nostr:npub1... to [@username](link) and nostr:naddr1... to [Article Title](link)
 * Labels update progressively as profiles load
 * @param markdown The markdown content to process
 * @param profileLabels Map of pubkey (hex) -> display name (e.g., pubkey -> @username)
 * @param articleTitles Map of naddr -> title for resolved articles
 * @param profileLoading Map of pubkey (hex) -> boolean indicating if profile is loading
 */
export function replaceNostrUrisInMarkdownWithProfileLabels(
  markdown: string,
  profileLabels: Map<string, string> = new Map(),
  articleTitles: Map<string, string> = new Map(),
  profileLoading: Map<string, boolean> = new Map()
): string {
  console.log(`[profile-loading-debug][nostr-uri-resolve] Processing markdown, profileLabels=${profileLabels.size}, profileLoading=${profileLoading.size}`)
  console.log(`[profile-loading-debug][nostr-uri-resolve] Loading keys:`, Array.from(profileLoading.entries()).filter(([, l]) => l).map(([k]) => k.slice(0, 16) + '...'))
  
  return replaceNostrUrisSafely(markdown, (encoded) => {
    const link = createNostrLink(encoded)
    
    // For articles, use the resolved title if available
    try {
      const decoded = decode(encoded)
      if (decoded.type === 'naddr' && articleTitles.has(encoded)) {
        const title = articleTitles.get(encoded)!
        return `[${title}](${link})`
      }
      
      // For npub/nprofile, extract pubkey and use it as the lookup key
      if (decoded.type === 'npub' || decoded.type === 'nprofile') {
        const pubkey = decoded.type === 'npub' ? decoded.data : decoded.data.pubkey
        
        // Check if we have a resolved profile name using pubkey as key
        // Only use Map value if profile is not loading (meaning it's actually resolved)
        const isLoading = profileLoading.get(pubkey)
        if (!isLoading && profileLabels.has(pubkey)) {
          const displayName = profileLabels.get(pubkey)!
          return `[${displayName}](${link})`
        }
        
        // If loading or no resolved label yet, use fallback (will show loading via post-processing)
        const label = getNostrUriLabel(encoded)
        return `[${label}](${link})`
      }
    } catch (error) {
      // Ignore decode errors, fall through to default label
    }
    
    // For other types or if not resolved, use default label (shortened npub format)
    const label = getNostrUriLabel(encoded)
    return `[${label}](${link})`
  })
}

/**
 * Post-process rendered HTML to add loading class to profile links that are still loading
 * This is necessary because HTML inside markdown links doesn't render correctly
 * @param html The rendered HTML string
 * @param profileLoading Map of pubkey (hex) -> boolean indicating if profile is loading
 * @returns HTML with profile-loading class added to loading profile links
 */
export function addLoadingClassToProfileLinks(
  html: string,
  profileLoading: Map<string, boolean>
): string {
  if (profileLoading.size === 0) return html
  
  // Find all <a> tags with href starting with /p/ (profile links)
  return html.replace(/<a\s+[^>]*?href="\/p\/([^"]+)"[^>]*?>/g, (match, npub) => {
    try {
      // Decode npub to get pubkey
      const decoded = decode(npub)
      if (decoded.type !== 'npub') return match
      
      const pubkey = decoded.data
      
      // Check if this profile is loading
      const isLoading = profileLoading.get(pubkey)
      if (isLoading === true) {
        console.log(`[profile-loading-debug][post-process] Adding loading class to link for ${pubkey.slice(0, 16)}...`)
        // Add profile-loading class if not already present
        if (!match.includes('profile-loading')) {
          // Insert class before the closing >
          const classMatch = /class="([^"]*)"/.exec(match)
          if (classMatch) {
            // Update existing class attribute
            return match.replace(/class="([^"]*)"/, `class="$1 profile-loading"`)
          } else {
            // Add new class attribute
            return match.replace(/(<a\s+[^>]*?)>/, '$1 class="profile-loading">')
          }
        }
      }
    } catch (error) {
      // If decoding fails, just return the original match
    }
    
    return match
  })
}

/**
 * Replace nostr: URIs in HTML with clickable links
 * This is used when processing HTML content directly
 */
export function replaceNostrUrisInHTML(html: string): string {
  return html.replace(NOSTR_URI_REGEX, (_match, encoded) => {
    // encoded is already the NIP-19 identifier without nostr: prefix (from capture group)
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

