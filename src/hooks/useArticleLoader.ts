import { useEffect, Dispatch, SetStateAction } from 'react'
import { RelayPool } from 'applesauce-relay'
import { fetchArticleByNaddr } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { ReadableContent } from '../services/readerService'
import { Highlight } from '../types/highlights'
import { NostrEvent } from 'nostr-tools'
import { UserSettings } from '../services/settingsService'
import { useMountedState } from './useMountedState'

interface UseArticleLoaderProps {
  naddr: string | undefined
  relayPool: RelayPool | null
  setSelectedUrl: (url: string) => void
  setReaderContent: (content: ReadableContent | undefined) => void
  setReaderLoading: (loading: boolean) => void
  setIsCollapsed: (collapsed: boolean) => void
  setHighlights: Dispatch<SetStateAction<Highlight[]>>
  setHighlightsLoading: (loading: boolean) => void
  setCurrentArticleCoordinate: (coord: string | undefined) => void
  setCurrentArticleEventId: (id: string | undefined) => void
  setCurrentArticle?: (article: NostrEvent) => void
  settings?: UserSettings
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
  setCurrentArticle,
  settings
}: UseArticleLoaderProps) {
  const isMounted = useMountedState()
  
  useEffect(() => {
    if (!relayPool || !naddr) return
    
    const loadArticle = async () => {
      if (!isMounted()) return
      
      setReaderLoading(true)
      setReaderContent(undefined)
      setSelectedUrl(`nostr:${naddr}`)
      setIsCollapsed(true)
      
      try {
        const article = await fetchArticleByNaddr(relayPool, naddr, false, settings)
        
        if (!isMounted()) return
        
        setReaderContent({
          title: article.title,
          markdown: article.markdown,
          image: article.image,
          summary: article.summary,
          published: article.published,
          url: `nostr:${naddr}`
        })
        
        const dTag = article.event.tags.find(t => t[0] === 'd')?.[1] || ''
        const articleCoordinate = `${article.event.kind}:${article.author}:${dTag}`
        
        setCurrentArticleCoordinate(articleCoordinate)
        setCurrentArticleEventId(article.event.id)
        setCurrentArticle?.(article.event)
        setReaderLoading(false)
        
        // Fetch highlights asynchronously without blocking article display
        try {
          if (!isMounted()) return
          
          setHighlightsLoading(true)
          setHighlights([])
          
          await fetchHighlightsForArticle(
            relayPool, 
            articleCoordinate, 
            article.event.id,
            (highlight) => {
              if (!isMounted()) return
              
              setHighlights((prev: Highlight[]) => {
                if (prev.some((h: Highlight) => h.id === highlight.id)) return prev
                const next = [highlight, ...prev]
                return next.sort((a, b) => b.created_at - a.created_at)
              })
            },
            settings
          )
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          if (isMounted()) {
            setHighlightsLoading(false)
          }
        }
      } catch (err) {
        console.error('Failed to load article:', err)
        if (isMounted()) {
          setReaderContent({
            title: 'Error Loading Article',
            html: `<p>Failed to load article: ${err instanceof Error ? err.message : 'Unknown error'}</p>`,
            url: `nostr:${naddr}`
          })
          setReaderLoading(false)
        }
      }
    }
    
    loadArticle()
    // Intentionally excluding setter functions from dependencies to prevent race conditions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naddr, relayPool, settings, isMounted])
}
