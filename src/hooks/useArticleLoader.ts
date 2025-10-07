import { useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { fetchArticleByNaddr } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { ReadableContent } from '../services/readerService'
import { Highlight } from '../types/highlights'
import { NostrEvent } from 'nostr-tools'

interface UseArticleLoaderProps {
  naddr: string | undefined
  relayPool: RelayPool | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: ReadableContent | undefined) => void
  setReaderLoading: (loading: boolean) => void
  setIsCollapsed: (collapsed: boolean) => void
  setHighlights: (highlights: Highlight[]) => void
  setHighlightsLoading: (loading: boolean) => void
  setCurrentArticleCoordinate: (coord: string | undefined) => void
  setCurrentArticleEventId: (id: string | undefined) => void
  setCurrentArticle?: (article: NostrEvent) => void
}

export function useArticleLoader({
  naddr,
  relayPool,
  setSelectedUrl,
  setReaderContent,
  setReaderLoading,
  setIsCollapsed,
  setHighlights,
  setHighlightsLoading,
  setCurrentArticleCoordinate,
  setCurrentArticleEventId,
  setCurrentArticle
}: UseArticleLoaderProps) {
  useEffect(() => {
    if (!relayPool || !naddr) return
    
    const loadArticle = async () => {
      setReaderLoading(true)
      setReaderContent(undefined)
      setSelectedUrl(`nostr:${naddr}`)
      setIsCollapsed(true)
      // Keep highlights panel collapsed by default - only open on user interaction
      
      try {
        const article = await fetchArticleByNaddr(relayPool, naddr)
        setReaderContent({
          title: article.title,
          markdown: article.markdown,
          image: article.image,
          url: `nostr:${naddr}`
        })
        
        const dTag = article.event.tags.find(t => t[0] === 'd')?.[1] || ''
        const articleCoordinate = `${article.event.kind}:${article.author}:${dTag}`
        
        setCurrentArticleCoordinate(articleCoordinate)
        setCurrentArticleEventId(article.event.id)
        setCurrentArticle?.(article.event)
        
        console.log('📰 Article loaded:', article.title)
        console.log('📍 Coordinate:', articleCoordinate)
        
        // Set reader loading to false immediately after article content is ready
        // Don't wait for highlights to finish loading
        setReaderLoading(false)
        
        // Fetch highlights asynchronously without blocking article display
        // Stream them as they arrive for instant rendering
        try {
          setHighlightsLoading(true)
          setHighlights([]) // Clear old highlights
          const highlightsList: Highlight[] = []
          
          await fetchHighlightsForArticle(
            relayPool, 
            articleCoordinate, 
            article.event.id,
            (highlight) => {
              // Render each highlight immediately as it arrives
              highlightsList.push(highlight)
              setHighlights([...highlightsList].sort((a, b) => b.created_at - a.created_at))
            }
          )
          console.log(`📌 Found ${highlightsList.length} highlights`)
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          setHighlightsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load article:', err)
        setReaderContent({
          title: 'Error Loading Article',
          html: `<p>Failed to load article: ${err instanceof Error ? err.message : 'Unknown error'}</p>`,
          url: `nostr:${naddr}`
        })
        setReaderLoading(false)
      }
    }
    
    loadArticle()
  }, [naddr, relayPool, setSelectedUrl, setReaderContent, setReaderLoading, setIsCollapsed, setHighlights, setHighlightsLoading, setCurrentArticleCoordinate, setCurrentArticleEventId, setCurrentArticle])
}
