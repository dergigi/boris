import { useEffect, useRef } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IAccount, IEventStore } from 'applesauce-core'
import { syncLocalEventsToRemote } from '../services/offlineSyncService'
import { isLocalRelay } from '../utils/helpers'
import { RelayStatus } from '../services/relayStatusService'

interface UseOfflineSyncParams {
  relayPool: RelayPool | null
  account: IAccount | null
  eventStore: IEventStore | null
  relayStatuses: RelayStatus[]
  enabled?: boolean
}

export function useOfflineSync({
  relayPool,
  account,
  eventStore,
  relayStatuses,
  enabled = true
}: UseOfflineSyncParams) {
  const previousStateRef = useRef<{
    hasRemoteRelays: boolean
    initialized: boolean
  }>({
    hasRemoteRelays: false,
    initialized: false
  })

  useEffect(() => {
    if (!enabled || !relayPool || !account || !eventStore) return

    const connectedRelays = relayStatuses.filter(r => r.isInPool)
    const hasRemoteRelays = connectedRelays.some(r => !isLocalRelay(r.url))
    const hasLocalRelays = connectedRelays.some(r => isLocalRelay(r.url))

    // Skip the first check to avoid syncing on initial load
    if (!previousStateRef.current.initialized) {
      previousStateRef.current = {
        hasRemoteRelays,
        initialized: true
      }
      return
    }

    // Detect transition: from local-only to having remote relays
    const wasLocalOnly = !previousStateRef.current.hasRemoteRelays && hasLocalRelays
    const isNowOnline = hasRemoteRelays

    if (wasLocalOnly && isNowOnline) {
      console.log('✈️ Detected transition: Flight Mode → Online')
      console.log('📊 Relay state:', {
        connectedRelays: connectedRelays.length,
        remoteRelays: connectedRelays.filter(r => !isLocalRelay(r.url)).length,
        localRelays: connectedRelays.filter(r => isLocalRelay(r.url)).length
      })
      
      // Wait a moment for relays to fully establish connections
      setTimeout(() => {
        console.log('🚀 Starting sync after delay...')
        syncLocalEventsToRemote(relayPool, account, eventStore)
      }, 2000)
    }

    previousStateRef.current.hasRemoteRelays = hasRemoteRelays
  }, [relayPool, account, eventStore, relayStatuses, enabled])
}

