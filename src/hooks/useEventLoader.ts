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
    // Format event metadata as HTML header
    const metaHtml = `<div style="opacity: 0.6; font-size: 0.9em; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
      <div>Event ID: <code>${event.id.slice(0, 16)}...</code></div>
      <div>Posted: ${new Date(event.created_at * 1000).toLocaleString()}</div>
      <div>Kind: ${event.kind}</div>
    </div>`

    // Escape HTML in content and convert newlines to breaks for plain text display
    const escapedContent = event.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')

    const content: ReadableContent = {
      url: `nostr:${event.id}`,
      html: metaHtml + `<div style="white-space: pre-wrap; word-break: break-word;">${escapedContent}</div>`,
      title: `Note (${event.kind})`
    }
    setReaderContent(content)
  }, [setReaderContent])

  useEffect(() => {
    if (!eventId) return

    // Try to get from event store first - do this synchronously before setting loading state
    if (eventStore) {
      const cachedEvent = eventStore.getEvent(eventId)
      if (cachedEvent) {
        displayEvent(cachedEvent)
        setReaderLoading(false)
        setIsCollapsed(false)
        setSelectedUrl(`nostr:${eventId}`)
        return
      }
    }

    // Event not in cache, now set loading state and fetch from relays
    setReaderLoading(true)
    setReaderContent(undefined)
    setSelectedUrl(`nostr:${eventId}`)
    setIsCollapsed(false)

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
        const errorContent: ReadableContent = {
          url: '',
          html: `<div style="padding: 1rem; color: var(--color-error, red);">Error loading event: ${err instanceof Error ? err.message : 'Unknown error'}</div>`,
          title: 'Error'
        }
        setReaderContent(errorContent)
        setReaderLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [eventId, relayPool, eventStore, displayEvent, setReaderLoading, setSelectedUrl, setIsCollapsed, setReaderContent])
}
