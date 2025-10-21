import { useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { ReadableContent } from '../services/readerService'
import { eventManager } from '../services/eventManager'
import { fetchProfiles } from '../services/profileService'

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

    // Initial title
    let title = `Note (${event.kind})`
    if (event.kind === 1) {
      title = `Note by @${event.pubkey.slice(0, 8)}...`
    }

    // Emit immediately
    const baseContent: ReadableContent = {
      url: '',
      html: metaHtml + `<div style="white-space: pre-wrap; word-break: break-word;">${escapedContent}</div>`,
      title
    }
    setReaderContent(baseContent)

    // Background: resolve author profile for kind:1 and update title
    if (event.kind === 1 && relayPool && eventStore) {
      (async () => {
        try {
          const profiles = await fetchProfiles(relayPool, eventStore as unknown as IEventStore, [event.pubkey])
          if (!profiles || profiles.length === 0) return
          const latest = profiles.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0]
          let resolved = ''
          try {
            const obj = JSON.parse(latest.content || '{}') as { name?: string; display_name?: string; nip05?: string }
            resolved = obj.display_name || obj.name || obj.nip05 || ''
          } catch {
            // ignore
          }
          if (resolved) {
            setReaderContent({ ...baseContent, title: `Note by @${resolved}` })
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
