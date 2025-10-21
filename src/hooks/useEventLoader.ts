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
    // Format event metadata as markdown comments for display
    const metaMarkdown = `<!-- Event ID: ${event.id.slice(0, 16)}... Posted: ${new Date(event.created_at * 1000).toLocaleString()} Kind: ${event.kind} -->`

    const content: ReadableContent = {
      url: `nostr:${event.id}`,
      markdown: metaMarkdown + '\n\n' + event.content,
      title: `Note (${event.kind})`
    }
    setReaderContent(content)
  }, [setReaderContent])

  useEffect(() => {
    if (!eventId) return

    console.log('🔍 useEventLoader: Loading event:', eventId)
    setReaderLoading(true)
    setReaderContent(undefined)
    setSelectedUrl(`nostr:${eventId}`)
    setIsCollapsed(false)

    // Try to get from event store first
    if (eventStore) {
      const cachedEvent = eventStore.getEvent(eventId)
      if (cachedEvent) {
        console.log('✅ useEventLoader: Found cached event:', cachedEvent)
        displayEvent(cachedEvent)
        setReaderLoading(false)
        return
      }
    }

    // Otherwise fetch from relays
    if (!relayPool) {
      console.log('❌ useEventLoader: No relay pool available')
      setReaderLoading(false)
      return
    }

    console.log('📡 useEventLoader: Fetching from relays...')
    const eventLoader = createEventLoader(relayPool, {
      eventStore: eventStore ?? undefined
    })

    const subscription = eventLoader({ id: eventId }).subscribe({
      next: (event) => {
        console.log('✅ useEventLoader: Fetched event from relays:', event)
        displayEvent(event)
        setReaderLoading(false)
      },
      error: (err) => {
        console.error('❌ useEventLoader: Error fetching event:', err)
        const errorContent: ReadableContent = {
          url: '',
          markdown: `Error loading event: ${err instanceof Error ? err.message : 'Unknown error'}`,
          title: 'Error'
        }
        setReaderContent(errorContent)
        setReaderLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [eventId, relayPool, eventStore, displayEvent, setReaderLoading, setSelectedUrl, setIsCollapsed, setReaderContent])
}
