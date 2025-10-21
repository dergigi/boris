import { useEffect, useRef, useMemo } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { fetchReadableContent, ReadableContent } from '../services/readerService'
import { fetchHighlightsForUrl } from '../services/highlightService'
import { Highlight } from '../types/highlights'
import { useStoreTimeline } from './useStoreTimeline'
import { eventToHighlight } from '../services/highlightEventProcessor'
import { KINDS } from '../config/kinds'

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
  const mountedRef = useRef(true)
  
  // Load cached URL-specific highlights from event store
  const urlFilter = useMemo(() => {
    if (!url) return null
    return { kinds: [KINDS.Highlights], '#r': [url] }
  }, [url])
  
  const cachedUrlHighlights = useStoreTimeline(
    eventStore || null,
    urlFilter || { kinds: [KINDS.Highlights], limit: 0 },
    eventToHighlight,
    [url]
  )
  
  // Load content and start streaming highlights when URL changes
  useEffect(() => {
    mountedRef.current = true
    
    if (!relayPool || !url) return
    
    const loadExternalUrl = async () => {
      if (!mountedRef.current) return
      
      setReaderLoading(true)
      setReaderContent(undefined)
      setSelectedUrl(url)
      setIsCollapsed(true)
      setCurrentArticleCoordinate(undefined)
      setCurrentArticleEventId(undefined)
      
      try {
        const content = await fetchReadableContent(url)
        
        if (!mountedRef.current) return
        
        setReaderContent(content)
        setReaderLoading(false)
        
        // Fetch highlights for this URL asynchronously
        try {
          if (!mountedRef.current) return
          
          setHighlightsLoading(true)
          
          // Seed with cached highlights first
          if (cachedUrlHighlights.length > 0) {
            setHighlights((prev) => {
              const seen = new Set<string>(cachedUrlHighlights.map(h => h.id))
              const localOnly = prev.filter(h => !seen.has(h.id))
              const next = [...cachedUrlHighlights, ...localOnly]
              return next.sort((a, b) => b.created_at - a.created_at)
            })
          } else {
            setHighlights([])
          }
          
          if (typeof fetchHighlightsForUrl === 'function') {
            const seen = new Set<string>()
            cachedUrlHighlights.forEach(h => seen.add(h.id))
            
            await fetchHighlightsForUrl(
              relayPool,
              url,
              (highlight) => {
                if (!mountedRef.current) return
                
                if (seen.has(highlight.id)) return
                seen.add(highlight.id)
                setHighlights((prev) => {
                  if (prev.some(h => h.id === highlight.id)) return prev
                  const next = [highlight, ...prev]
                  return next.sort((a, b) => b.created_at - a.created_at)
                })
              },
              undefined,
              false,
              eventStore || undefined
            )
          }
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          if (mountedRef.current) {
            setHighlightsLoading(false)
          }
        }
      } catch (err) {
        console.error('Failed to load external URL:', err)
        if (mountedRef.current) {
          const filename = getFilenameFromUrl(url)
          setReaderContent({
            title: filename,
            html: `<p>Failed to load content: ${err instanceof Error ? err.message : 'Unknown error'}</p>`,
            url
          })
          setReaderLoading(false)
        }
      }
    }
    
    loadExternalUrl()
    
    return () => {
      mountedRef.current = false
    }
  }, [
    url,
    relayPool,
    eventStore,
    cachedUrlHighlights,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setSelectedUrl,
    setHighlights
  ])

  // Keep UI highlights synced with cached store updates without reloading content
  useEffect(() => {
    if (!url) return
    if (cachedUrlHighlights.length === 0) return
    setHighlights((prev) => {
      const seen = new Set<string>(prev.map(h => h.id))
      const additions = cachedUrlHighlights.filter(h => !seen.has(h.id))
      if (additions.length === 0) return prev
      const next = [...additions, ...prev]
      return next.sort((a, b) => b.created_at - a.created_at)
    })
  }, [cachedUrlHighlights, url, setHighlights])
}

