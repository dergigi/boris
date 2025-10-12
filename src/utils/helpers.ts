// Extract pubkeys from nprofile strings in content
export const extractNprofilePubkeys = (content: string): string[] => {
  const nprofileRegex = /nprofile1[a-z0-9]+/gi
  const matches = content.match(nprofileRegex) || []
  const unique = new Set<string>(matches)
  return Array.from(unique)
}

export type UrlType = 'video' | 'image' | 'youtube' | 'article'

export interface UrlClassification {
  type: UrlType
  buttonText: string
}

export const classifyUrl = (url: string | undefined): UrlClassification => {
  if (!url) {
    return { type: 'article', buttonText: 'READ NOW' }
  }
  const urlLower = url.toLowerCase()
  
  // Check for YouTube
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { type: 'youtube', buttonText: 'WATCH NOW' }
  }
  
  // Check for video extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v']
  if (videoExtensions.some(ext => urlLower.includes(ext))) {
    return { type: 'video', buttonText: 'WATCH NOW' }
  }
  
  // Check for image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  if (imageExtensions.some(ext => urlLower.includes(ext))) {
    return { type: 'image', buttonText: 'VIEW NOW' }
  }
  
  // Default to article
  return { type: 'article', buttonText: 'READ NOW' }
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

export function createParallelReqStreams(
  relayPool: RelayPool,
  localRelays: string[],
  remoteRelays: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: any,
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

