import { useState, useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { RelayStatus, updateAndGetRelayStatuses } from '../services/relayStatusService'

interface UseRelayStatusParams {
  relayPool: RelayPool | null
  pollingInterval?: number // in milliseconds
}

export function useRelayStatus({ 
  relayPool, 
  pollingInterval = 20000 
}: UseRelayStatusParams) {
  const [relayStatuses, setRelayStatuses] = useState<RelayStatus[]>([])

  useEffect(() => {
    if (!relayPool) return

    const updateStatuses = () => {
      const statuses = updateAndGetRelayStatuses(relayPool)
      setRelayStatuses(statuses)
    }

    // Initial update
    updateStatuses()

    // Poll for updates
    const interval = setInterval(updateStatuses, pollingInterval)

    return () => {
      clearInterval(interval)
    }
  }, [relayPool, pollingInterval])

  return relayStatuses
}

