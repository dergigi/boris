import { useEffect, useCallback, useState } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { ReadableContent } from '../services/readerService'
import { eventManager } from '../services/eventManager'
import { fetchProfiles } from '../services/profileService'
import { useDocumentTitle } from './useDocumentTitle'

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
  // Track the current event title for document title
  const [currentTitle, setCurrentTitle] = useState<string | undefined>()
  useDocumentTitle({ title: currentTitle })
  const displayEvent = useCallback((event: NostrEvent) => {
    // Escape HTML in content and convert newlines to breaks for plain text display
    const escapedContent = event.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')

    // Initial title
    let title = `Note (${event.kind})`
    if (event.kind === 1) {
      title = `Note by @${event.pubkey.slice(0, 8)}...`
    }

    // Emit immediately
    const baseContent: ReadableContent = {
      url: '',
      html: `<div style="white-space: pre-wrap; word-break: break-word;">${escapedContent}</div>`,
      title,
      published: event.created_at
    }
    setCurrentTitle(title)
    setReaderContent(baseContent)

    // Background: resolve author profile for kind:1 and update title
    if (event.kind === 1 && eventStore) {
      (async () => {
        try {
          let resolved = ''

          // First, try to get from event store cache
          const storedProfile = eventStore.getEvent(event.pubkey + ':0')
          if (storedProfile) {
            try {
              const obj = JSON.parse(storedProfile.content || '{}') as { name?: string; display_name?: string; nip05?: string }
              resolved = obj.display_name || obj.name || obj.nip05 || ''
            } catch {
              // ignore parse errors
            }
          }

          // If not found in event store, fetch from relays
          if (!resolved && relayPool) {
            const profiles = await fetchProfiles(relayPool, eventStore as unknown as IEventStore, [event.pubkey])
            if (profiles && profiles.length > 0) {
              const latest = profiles.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0]
              try {
                const obj = JSON.parse(latest.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                resolved = obj.display_name || obj.name || obj.nip05 || ''
              } catch {
                // ignore parse errors
              }
            }
          }

          if (resolved) {
            const updatedTitle = `Note by @${resolved}`
            setCurrentTitle(updatedTitle)
            setReaderContent({ ...baseContent, title: updatedTitle })
          }
        } catch {
          // ignore profile failures; keep fallback title
        }
      })()
    }
  }, [setReaderContent, relayPool, eventStore])

  // Initialize event manager with services
  useEffect(() => {
    eventManager.setServices(eventStore || null, relayPool || null)
  }, [eventStore, relayPool])

  useEffect(() => {
    if (!eventId) return

    setReaderLoading(true)
    setReaderContent(undefined)
    setSelectedUrl(`nostr-event:${eventId}`) // sentinel: truthy selection, not treated as article
    setIsCollapsed(false)

    // Fetch using event manager (handles cache, deduplication, and retry)
    let cancelled = false

    eventManager.fetchEvent(eventId).then(
      (event) => {
        if (!cancelled) {
          displayEvent(event)
          setReaderLoading(false)
        }
      },
      (err) => {
        if (!cancelled) {
          const errorContent: ReadableContent = {
            url: '',
            html: `<div style="padding: 1rem; color: var(--color-error, red);">Failed to load event: ${err instanceof Error ? err.message : 'Unknown error'}</div>`,
            title: 'Error'
          }
          setCurrentTitle('Error')
          setReaderContent(errorContent)
          setReaderLoading(false)
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [eventId, displayEvent, setReaderLoading, setSelectedUrl, setIsCollapsed, setReaderContent])
}
