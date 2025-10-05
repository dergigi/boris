import { useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { fetchArticleByNaddr } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { ReadableContent } from '../services/readerService'
import { Highlight } from '../types/highlights'

interface UseArticleLoaderProps {
  naddr: string | undefined
  relayPool: RelayPool | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: ReadableContent | undefined) => void
  setReaderLoading: (loading: boolean) => void
  setIsCollapsed: (collapsed: boolean) => void
  setIsHighlightsCollapsed: (collapsed: boolean) => void
  setHighlights: (highlights: Highlight[]) => void
  setHighlightsLoading: (loading: boolean) => void
  setCurrentArticleCoordinate: (coord: string | undefined) => void
  setCurrentArticleEventId: (id: string | undefined) => void
}

export function useArticleLoader({
  naddr,
  relayPool,
  setSelectedUrl,
  setReaderContent,
  setReaderLoading,
  setIsCollapsed,
  setIsHighlightsCollapsed,
  setHighlights,
  setHighlightsLoading,
  setCurrentArticleCoordinate,
  setCurrentArticleEventId
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
        
        console.log('📰 Article loaded:', article.title)
        console.log('📍 Coordinate:', articleCoordinate)
        
        try {
          setHighlightsLoading(true)
          const fetchedHighlights = await fetchHighlightsForArticle(
            relayPool, 
            articleCoordinate, 
            article.event.id
          )
          console.log(`📌 Found ${fetchedHighlights.length} highlights`)
          setHighlights(fetchedHighlights)
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
      } finally {
        setReaderLoading(false)
      }
    }
    
    loadArticle()
  }, [naddr, relayPool])
}
