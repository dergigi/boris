import { useEffect, useRef, Dispatch, SetStateAction } from 'react'
import { RelayPool } from 'applesauce-relay'
import { fetchArticleByNaddr } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { ReadableContent } from '../services/readerService'
import { Highlight } from '../types/highlights'
import { NostrEvent } from 'nostr-tools'
import { UserSettings } from '../services/settingsService'

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
  const mountedRef = useRef(true)
  // Hold latest settings without retriggering effect
  const settingsRef = useRef<UserSettings | undefined>(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  // Track in-flight request to prevent stale updates from previous naddr
  const currentRequestIdRef = useRef(0)
  
  useEffect(() => {
    mountedRef.current = true
    
    if (!relayPool || !naddr) return
    
    const loadArticle = async () => {
      const requestId = ++currentRequestIdRef.current
      if (!mountedRef.current) return
      
      setReaderLoading(true)
      setReaderContent(undefined)
      setSelectedUrl(`nostr:${naddr}`)
      setIsCollapsed(true)
      
      try {
        const article = await fetchArticleByNaddr(relayPool, naddr, false, settingsRef.current)
        
        if (!mountedRef.current) return
        // Ignore if a newer request has started
        if (currentRequestIdRef.current !== requestId) return
        
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
          if (!mountedRef.current) return
          
          setHighlightsLoading(true)
          setHighlights([])
          
          await fetchHighlightsForArticle(
            relayPool, 
            articleCoordinate, 
            article.event.id,
            (highlight) => {
              if (!mountedRef.current) return
              // Ignore highlights from stale request
              if (currentRequestIdRef.current !== requestId) return
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
          if (mountedRef.current && currentRequestIdRef.current === requestId) {
            setHighlightsLoading(false)
          }
        }
      } catch (err) {
        console.error('Failed to load article:', err)
        if (mountedRef.current && currentRequestIdRef.current === requestId) {
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
    
    return () => {
      mountedRef.current = false
    }
  }, [
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
  ])
}
