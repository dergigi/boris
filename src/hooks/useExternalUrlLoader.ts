import { useEffect, useRef, useMemo, useState } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { fetchReadableContent, ReadableContent } from '../services/readerService'
import { fetchHighlightsForUrl } from '../services/highlightService'
import { Highlight } from '../types/highlights'
import { useStoreTimeline } from './useStoreTimeline'
import { eventToHighlight } from '../services/highlightEventProcessor'
import { KINDS } from '../config/kinds'
import { useDocumentTitle } from './useDocumentTitle'

// Helper to extract filename from URL
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
    // Decode URI component to handle special characters
    return decodeURIComponent(filename) || url
  } catch {
    return url
  }
}

interface UseExternalUrlLoaderProps {
  url: string | undefined
  relayPool: RelayPool | null
  eventStore?: IEventStore | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: ReadableContent | undefined) => void
  setReaderLoading: (loading: boolean) => void
  setIsCollapsed: (collapsed: boolean) => void
  setHighlights: (highlights: Highlight[] | ((prev: Highlight[]) => Highlight[])) => void
  setHighlightsLoading: (loading: boolean) => void
  setCurrentArticleCoordinate: (coord: string | undefined) => void
  setCurrentArticleEventId: (id: string | undefined) => void
}

export function useExternalUrlLoader({
  url,
  relayPool,
  eventStore,
  setSelectedUrl,
  setReaderContent,
  setReaderLoading,
  setIsCollapsed,
  setHighlights,
  setHighlightsLoading,
  setCurrentArticleCoordinate,
  setCurrentArticleEventId
}: UseExternalUrlLoaderProps) {
  // Refs keep callbacks fresh without coupling article fetching to relay/store updates.
  const callbacks = useRef({ setSelectedUrl, setReaderContent, setReaderLoading, setIsCollapsed,
    setHighlights, setHighlightsLoading, setCurrentArticleCoordinate, setCurrentArticleEventId })
  callbacks.current = { setSelectedUrl, setReaderContent, setReaderLoading, setIsCollapsed,
    setHighlights, setHighlightsLoading, setCurrentArticleCoordinate, setCurrentArticleEventId }
  const [currentTitle, setCurrentTitle] = useState<string | undefined>()
  useDocumentTitle({ title: currentTitle })
  const urlFilter = useMemo(() => ({ kinds: [KINDS.Highlights], '#r': url ? [url] : [], limit: url ? undefined : 0 }), [url])
  const cachedHighlights = useStoreTimeline(eventStore || null, urlFilter, eventToHighlight, [url])

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    const cb = callbacks.current
    setCurrentTitle(undefined)
    cb.setReaderLoading(true)
    cb.setReaderContent(undefined)
    cb.setSelectedUrl(url)
    cb.setIsCollapsed(true)
    cb.setCurrentArticleCoordinate(undefined)
    cb.setCurrentArticleEventId(undefined)
    cb.setHighlights([])
    cb.setHighlightsLoading(false)
    fetchReadableContent(url, false, controller.signal).then(content => {
      if (controller.signal.aborted) return
      setCurrentTitle(content.title)
      cb.setReaderContent(content)
    }).catch(error => {
      if (controller.signal.aborted) return
      cb.setReaderContent({ url, title: getFilenameFromUrl(url),
        error: error instanceof Error ? error.message : 'Unable to load this article.' })
    }).finally(() => {
      if (!controller.signal.aborted) cb.setReaderLoading(false)
    })
    return () => controller.abort()
  }, [url])

  // Highlights load independently; a slow/offline relay never blocks web articles.
  useEffect(() => {
    if (!url) return
    if (!relayPool) {
      callbacks.current.setHighlightsLoading(false)
      return
    }
    let cancelled = false
    const cb = callbacks.current
    cb.setHighlightsLoading(true)
    fetchHighlightsForUrl(relayPool, url, highlight => {
      if (cancelled) return
      cb.setHighlights(prev => prev.some(h => h.id === highlight.id) ? prev :
        [highlight, ...prev].sort((a, b) => b.created_at - a.created_at))
    }, undefined, false, eventStore || undefined).catch(error => {
      console.warn('Failed to fetch highlights:', error)
    }).finally(() => { if (!cancelled) cb.setHighlightsLoading(false) })
    return () => { cancelled = true }
  }, [url, relayPool, eventStore])

  useEffect(() => {
    if (!url || !cachedHighlights.length) return
    callbacks.current.setHighlights(prev => {
      const seen = new Set(prev.map(h => h.id))
      const additions = cachedHighlights.filter(h => h.urlReference === url && !seen.has(h.id))
      return additions.length ? [...prev, ...additions].sort((a, b) => b.created_at - a.created_at) : prev
    })
  }, [url, cachedHighlights])
}
