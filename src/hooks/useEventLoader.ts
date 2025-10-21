import { useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { ReadableContent } from '../services/readerService'
import { eventManager } from '../services/eventManager'

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
      url: '', // Empty URL to prevent highlight display
      html: metaHtml + `<div style="white-space: pre-wrap; word-break: break-word;">${escapedContent}</div>`,
      title: `Note (${event.kind})`
    }
    setReaderContent(content)
  }, [setReaderContent])

  // Initialize event manager with services
  useEffect(() => {
    eventManager.setServices(eventStore || null, relayPool || null)
  }, [eventStore, relayPool])

  useEffect(() => {
    if (!eventId) return

    // Try to get from event store first (check cache synchronously)
    const cachedEvent = eventManager.getCachedEvent(eventId)
    if (cachedEvent) {
      displayEvent(cachedEvent)
      setReaderLoading(false)
      setIsCollapsed(false)
      setSelectedUrl('')
      return
    }

    // Event not in cache, set loading state and fetch from relays
    setReaderLoading(true)
    setReaderContent(undefined)
    setSelectedUrl('') // Don't set nostr: URL to avoid showing highlights
    setIsCollapsed(false)

    // If no relay pool yet, wait for it (will re-run when relayPool changes)
    if (!relayPool) {
      return
    }

    // Fetch from relays using event manager's loader
    const eventLoader = eventManager.getEventLoader()
    if (!eventLoader) {
      setReaderLoading(false)
      return
    }

    const subscription = eventLoader({ id: eventId }).subscribe({
      next: (event) => {
        displayEvent(event)
        setReaderLoading(false)
      },
      error: (err) => {
        const errorContent: ReadableContent = {
          url: '',
          html: `<div style="padding: 1rem; color: var(--color-error, red);">Failed to load event: ${err instanceof Error ? err.message : 'Unknown error'}</div>`,
          title: 'Error'
        }
        setReaderContent(errorContent)
        setReaderLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [eventId, relayPool, displayEvent, setReaderLoading, setSelectedUrl, setIsCollapsed, setReaderContent])
}
