import { IEventStore } from 'applesauce-core'
import { loadCachedProfiles } from '../services/profileService'

/**
 * Check if a profile exists in cache or eventStore
 * Used to determine if profile loading state should be shown
 * @param pubkey The pubkey in hex format
 * @param eventStore Optional eventStore instance
 * @returns true if profile exists in cache or eventStore, false otherwise
 */
export function isProfileInCacheOrStore(
  pubkey: string,
  eventStore?: IEventStore | null
): boolean {
  if (!pubkey) return false
  
  // Check cache first
  const cached = loadCachedProfiles([pubkey])
  if (cached.has(pubkey)) {
    return true
  }
  
  // Check eventStore
  const eventStoreProfile = eventStore?.getEvent(pubkey + ':0')
  return !!eventStoreProfile
}

