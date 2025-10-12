import { useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { fetchReadableContent, ReadableContent } from '../services/readerService'
import { fetchHighlightsForUrl } from '../services/highlightService'
import { Highlight } from '../types/highlights'

interface UseExternalUrlLoaderProps {
  url: string | undefined
  relayPool: RelayPool | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: ReadableContent | undefined) => void
  setReaderLoading: (loading: boolean) => void
  setIsCollapsed: (collapsed: boolean) => void
  setHighlights: (highlights: Highlight[]) => void
  setHighlightsLoading: (loading: boolean) => void
  setCurrentArticleCoordinate: (coord: string | undefined) => void
  setCurrentArticleEventId: (id: string | undefined) => void
}

export function useExternalUrlLoader({
  url,
  relayPool,
  setSelectedUrl,
  setReaderContent,
  setReaderLoading,
  setIsCollapsed,
  setHighlights,
  setHighlightsLoading,
  setCurrentArticleCoordinate,
  setCurrentArticleEventId
}: UseExternalUrlLoaderProps) {
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
        
        console.log('🌐 External URL loaded:', content.title)
        
        // Set reader loading to false immediately after content is ready
        setReaderLoading(false)
        
        // Fetch highlights for this URL asynchronously
        try {
          setHighlightsLoading(true)
          setHighlights([])
          
          // Check if fetchHighlightsForUrl exists, otherwise skip
          if (typeof fetchHighlightsForUrl === 'function') {
            const seen = new Set<string>()
            const highlightsList = await fetchHighlightsForUrl(
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
              }
            )
            // Ensure final list is sorted and contains all items
            setHighlights(highlightsList.sort((a, b) => b.created_at - a.created_at))
            console.log(`📌 Found ${highlightsList.length} highlights for URL`)
          } else {
            console.log('📌 Highlight fetching for URLs not yet implemented')
          }
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          setHighlightsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load external URL:', err)
        setReaderContent({
          title: 'Error Loading Content',
          html: `<p>Failed to load content: ${err instanceof Error ? err.message : 'Unknown error'}</p>`,
          url
        })
        setReaderLoading(false)
      }
    }
    
    loadExternalUrl()
  }, [url, relayPool, setSelectedUrl, setReaderContent, setReaderLoading, setIsCollapsed, setHighlights, setHighlightsLoading, setCurrentArticleCoordinate, setCurrentArticleEventId])
}

