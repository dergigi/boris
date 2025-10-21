import { useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { createEventLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'
import { ReadableContent } from '../services/readerService'

interface UseEventLoaderProps {
  eventId?: string
  relayPool?: RelayPool | null
  eventStore?: IEventStore | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: ReadableContent | undefined) => void
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
  const displayEvent = useCallback((event: NostrEvent) => {
    // Format event HTML for display with metadata
    const metaHtml = `<div style="opacity: 0.6; font-size: 0.9em; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
      <div>Event ID: <code>${event.id.slice(0, 16)}...</code></div>
      <div>Posted: ${new Date(event.created_at * 1000).toLocaleString()}</div>
      <div>Kind: ${event.kind}</div>
    </div>`

    const content: ReadableContent = {
      url: '',
      html: metaHtml + event.content,
      title: `Note (${event.kind})`
    }
    setReaderContent(content)
  }, [setReaderContent])

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
      eventStore: eventStore ?? undefined
    })

    const subscription = eventLoader({ id: eventId }).subscribe({
      next: (event) => {
        displayEvent(event)
        setReaderLoading(false)
      },
      error: (err) => {
        console.error('Error fetching event:', err)
        const errorContent: ReadableContent = {
          url: '',
          html: `Error loading event: ${err instanceof Error ? err.message : 'Unknown error'}`,
          title: 'Error'
        }
        setReaderContent(errorContent)
        setReaderLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [eventId, relayPool, eventStore, displayEvent, setReaderLoading, setSelectedUrl, setIsCollapsed, setReaderContent])
}
