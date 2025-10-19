// Extract pubkeys from nprofile strings in content
import { READING_PROGRESS } from '../config/kinds'

export const extractNprofilePubkeys = (content: string): string[] => {
  const nprofileRegex = /nprofile1[a-z0-9]+/gi
  const matches = content.match(nprofileRegex) || []
  const unique = new Set<string>(matches)
  return Array.from(unique)
}

export type UrlType = 'video' | 'image' | 'youtube' | 'article'

export interface UrlClassification {
  type: UrlType
}

export const classifyUrl = (url: string | undefined): UrlClassification => {
  if (!url) {
    return { type: 'article' }
  }
  const urlLower = url.toLowerCase()
  
  // Check for YouTube
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { type: 'youtube' }
  }
  
  // Check for popular video hosts
  const videoHosts = ['vimeo.com', 'dailymotion.com', 'dai.ly', 'video.twimg.com']
  if (videoHosts.some(host => urlLower.includes(host))) {
    return { type: 'video' }
  }
  
  // Check for video extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v']
  if (videoExtensions.some(ext => urlLower.includes(ext))) {
    return { type: 'video' }
  }
  
  // Check for image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  if (imageExtensions.some(ext => urlLower.includes(ext))) {
    return { type: 'image' }
  }
  
  // Default to article
  return { type: 'article' }
}

/**
 * Checks if a relay URL is a local relay (localhost or 127.0.0.1)
 */
export const isLocalRelay = (relayUrl: string): boolean => {
  return relayUrl.includes('localhost') || relayUrl.includes('127.0.0.1')
}

/**
 * Checks if all relays in the list are local relays
 */
export const areAllRelaysLocal = (relayUrls: string[]): boolean => {
  if (!relayUrls || relayUrls.length === 0) return false
  return relayUrls.every(isLocalRelay)
}

/**
 * Checks if at least one relay is a remote (non-local) relay
 */
export const hasRemoteRelay = (relayUrls: string[]): boolean => {
  if (!relayUrls || relayUrls.length === 0) return false
  return relayUrls.some(url => !isLocalRelay(url))
}

/**
 * Splits relay URLs into local and remote groups
 */
export const partitionRelays = (
  relayUrls: string[]
): { local: string[]; remote: string[] } => {
  const local: string[] = []
  const remote: string[] = []
  for (const url of relayUrls) {
    if (isLocalRelay(url)) local.push(url)
    else remote.push(url)
  }
  return { local, remote }
}

/**
 * Returns relays ordered with local first while keeping uniqueness
 */
export const prioritizeLocalRelays = (relayUrls: string[]): string[] => {
  const { local, remote } = partitionRelays(relayUrls)
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of [...local, ...remote]) {
    if (!seen.has(url)) {
      seen.add(url)
      out.push(url)
    }
  }
  return out
}

// Parallel request helper
import { completeOnEose, onlyEvents, RelayPool } from 'applesauce-relay'
import { Observable, takeUntil, timer } from 'rxjs'
import { Filter } from 'nostr-tools/filter'

export function createParallelReqStreams(
  relayPool: RelayPool,
  localRelays: string[],
  remoteRelays: string[],
  filter: Filter,
  localTimeoutMs = 1200,
  remoteTimeoutMs = 6000
): { local$: Observable<unknown>; remote$: Observable<unknown> } {
  const local$ = (localRelays.length > 0)
    ? relayPool.req(localRelays, filter).pipe(onlyEvents(), completeOnEose(), takeUntil(timer(localTimeoutMs)))
    : new Observable<unknown>((sub) => { sub.complete() })

  const remote$ = (remoteRelays.length > 0)
    ? relayPool.req(remoteRelays, filter).pipe(onlyEvents(), completeOnEose(), takeUntil(timer(remoteTimeoutMs)))
    : new Observable<unknown>((sub) => { sub.complete() })

  return { local$, remote$ }
}

/**
 * Checks if content is long enough to track reading progress
 * Minimum 1000 characters (roughly 150 words)
 */
export const shouldTrackReadingProgress = (html: string | undefined, markdown: string | undefined): boolean => {
  const content = (html || markdown || '').trim()
  // Strip HTML tags to get character count
  const plainText = content.replace(/<[^>]*>/g, '').trim()
  return plainText.length >= READING_PROGRESS.MIN_CONTENT_LENGTH
}

