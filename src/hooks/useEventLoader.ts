import { useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { EventStore } from 'applesauce-core'
import { createEventLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'

interface UseEventLoaderProps {
  eventId?: string
  relayPool?: RelayPool | null
  eventStore?: EventStore | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: string) => void
  setReaderLoading: (loading: boolean) => void
  setIsCollapsed: (collapsed: boolean) => void
}

export function useEventLoader({
  eventId,
  relayPool,
  eventStore,
  setSelectedUrl,
  setReaderContent,
  setReaderLoading,
  setIsCollapsed
}: UseEventLoaderProps) {
  useEffect(() => {
    if (!eventId) return

    setReaderLoading(true)
    setSelectedUrl('')
    setIsCollapsed(false)

    // Try to get from event store first
    if (eventStore) {
      const cachedEvent = eventStore.getEvent(eventId)
      if (cachedEvent) {
        displayEvent(cachedEvent)
        setReaderLoading(false)
        return
      }
    }

    // Otherwise fetch from relays
    if (!relayPool) {
      setReaderLoading(false)
      return
    }

    const eventLoader = createEventLoader(relayPool, {
      eventStore,
      cacheRequest: true
    })

    const subscription = eventLoader({ id: eventId }).subscribe({
      next: (event) => {
        displayEvent(event)
        setReaderLoading(false)
      },
      error: (err) => {
        console.error('Error fetching event:', err)
        setReaderContent(`Error loading event: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setReaderLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [eventId, relayPool, eventStore])

  function displayEvent(event: NostrEvent) {
    // Format event for display with metadata
    const meta = `<div style="opacity: 0.6; font-size: 0.9em; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
      <div>Event ID: <code>${event.id.slice(0, 16)}...</code></div>
      <div>Posted: ${new Date(event.created_at * 1000).toLocaleString()}</div>
      <div>Kind: ${event.kind}</div>
    </div>`

    setReaderContent(meta + event.content)
  }
}
