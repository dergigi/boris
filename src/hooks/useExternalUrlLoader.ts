import { useEffect, useMemo } from 'react'
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
  
  useEffect(() => {
    if (!relayPool || !url) return
    
    const loadExternalUrl = async () => {
      setReaderLoading(true)
      setReaderContent(undefined)
      setSelectedUrl(url)
      setIsCollapsed(true)
      // Clear article-specific state
      setCurrentArticleCoordinate(undefined)
      setCurrentArticleEventId(undefined)
      
      try {
        const content = await fetchReadableContent(url)
        setReaderContent(content)
        
        
        // Set reader loading to false immediately after content is ready
        setReaderLoading(false)
        
        // Fetch highlights for this URL asynchronously
        try {
          setHighlightsLoading(true)
          
          // Seed with cached highlights first
          if (cachedUrlHighlights.length > 0) {
            setHighlights(cachedUrlHighlights.sort((a, b) => b.created_at - a.created_at))
          } else {
            setHighlights([])
          }
          
          // Check if fetchHighlightsForUrl exists, otherwise skip
          if (typeof fetchHighlightsForUrl === 'function') {
            const seen = new Set<string>()
            // Seed with cached IDs
            cachedUrlHighlights.forEach(h => seen.add(h.id))
            
            await fetchHighlightsForUrl(
              relayPool,
              url,
              (highlight) => {
                if (seen.has(highlight.id)) return
                seen.add(highlight.id)
                setHighlights((prev) => {
                  if (prev.some(h => h.id === highlight.id)) return prev
                  const next = [...prev, highlight]
                  return next.sort((a, b) => b.created_at - a.created_at)
                })
              },
              undefined, // settings
              false, // force
              eventStore || undefined
            )
          }
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          setHighlightsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load external URL:', err)
        // For videos and other media files, use the filename as the title
        const filename = getFilenameFromUrl(url)
        setReaderContent({
          title: filename,
          html: `<p>Failed to load content: ${err instanceof Error ? err.message : 'Unknown error'}</p>`,
          url
        })
        setReaderLoading(false)
      }
    }
    
    loadExternalUrl()
  }, [url, relayPool, eventStore, setSelectedUrl, setReaderContent, setReaderLoading, setIsCollapsed, setHighlights, setHighlightsLoading, setCurrentArticleCoordinate, setCurrentArticleEventId, cachedUrlHighlights])
}

