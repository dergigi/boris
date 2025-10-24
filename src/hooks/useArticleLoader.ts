import { useEffect, useRef, Dispatch, SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'
import { RelayPool } from 'applesauce-relay'
import type { IEventStore } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { Helpers } from 'applesauce-core'
import { queryEvents } from '../services/dataFetch'
import { fetchArticleByNaddr } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { ReadableContent } from '../services/readerService'
import { Highlight } from '../types/highlights'
import { NostrEvent } from 'nostr-tools'
import { UserSettings } from '../services/settingsService'

interface PreviewData {
  title: string
  image?: string
  summary?: string
  published?: number
}

interface UseArticleLoaderProps {
  naddr: string | undefined
  relayPool: RelayPool | null
  eventStore?: IEventStore | null
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
  currentArticleCoordinate?: string
  currentArticleEventId?: string
  highlightsLoading?: boolean
}

export function useArticleLoader({
  naddr,
  relayPool,
  eventStore,
  setSelectedUrl,
  setReaderContent,
  setReaderLoading,
  setIsCollapsed,
  setHighlights,
  setHighlightsLoading,
  setCurrentArticleCoordinate,
  setCurrentArticleEventId,
  setCurrentArticle,
  settings,
  currentArticleCoordinate,
  currentArticleEventId,
  highlightsLoading
}: UseArticleLoaderProps) {
  const location = useLocation()
  const mountedRef = useRef(true)
  // Hold latest settings without retriggering effect
  const settingsRef = useRef<UserSettings | undefined>(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  // Track in-flight request to prevent stale updates from previous naddr
  const currentRequestIdRef = useRef(0)
  
  // Extract preview data from navigation state (from blog post cards)
  const previewData = (location.state as { previewData?: PreviewData })?.previewData
  
  useEffect(() => {
    mountedRef.current = true
    
    if (!relayPool || !naddr) return
    
    const loadArticle = async () => {
      const requestId = ++currentRequestIdRef.current
      if (!mountedRef.current) return
      
      setSelectedUrl(`nostr:${naddr}`)
      setIsCollapsed(true)
      
      // Don't clear highlights yet - let the smart filtering logic handle it
      // when we know the article coordinate
      setHighlightsLoading(false) // Don't show loading yet
      
      // If we have preview data from navigation, show it immediately (no skeleton!)
      if (previewData) {
        setReaderContent({
          title: previewData.title,
          markdown: '', // Will be loaded from store or relay
          image: previewData.image,
          summary: previewData.summary,
          published: previewData.published,
          url: `nostr:${naddr}`
        })
        setReaderLoading(false) // Turn off loading immediately - we have the preview!
      } else {
        setReaderLoading(true)
        setReaderContent(undefined)
      }
      
      try {
        // Decode naddr to filter
        const decoded = nip19.decode(naddr)
        if (decoded.type !== 'naddr') {
          throw new Error('Invalid naddr format')
        }
        const pointer = decoded.data as AddressPointer
        const filter = {
          kinds: [pointer.kind],
          authors: [pointer.pubkey],
          '#d': [pointer.identifier]
        }

        let firstEmitted = false
        let latestEvent: NostrEvent | null = null

        // Check eventStore first for instant load (from bookmark cards, explore, etc.)
        if (eventStore) {
          try {
            const coordinate = `${pointer.kind}:${pointer.pubkey}:${pointer.identifier}`
            const storedEvent = eventStore.getEvent?.(coordinate)
            if (storedEvent) {
              latestEvent = storedEvent as NostrEvent
              firstEmitted = true
              const title = Helpers.getArticleTitle(storedEvent) || 'Untitled Article'
              const image = Helpers.getArticleImage(storedEvent)
              const summary = Helpers.getArticleSummary(storedEvent)
              const published = Helpers.getArticlePublished(storedEvent)
              setReaderContent({
                title,
                markdown: storedEvent.content,
                image,
                summary,
                published,
                url: `nostr:${naddr}`
              })
              const dTag = storedEvent.tags.find(t => t[0] === 'd')?.[1] || ''
              const articleCoordinate = `${storedEvent.kind}:${storedEvent.pubkey}:${dTag}`
              setCurrentArticleCoordinate(articleCoordinate)
              setCurrentArticleEventId(storedEvent.id)
              setCurrentArticle?.(storedEvent)
              setReaderLoading(false)
            }
          } catch (err) {
            // Ignore store errors, fall through to relay query
          }
        }

        // Stream local-first via queryEvents; rely on EOSE (no timeouts)
        const events = await queryEvents(relayPool, filter, {
          onEvent: (evt) => {
            if (!mountedRef.current) return
            if (currentRequestIdRef.current !== requestId) return

            // Store in event store for future local reads
            try { 
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              eventStore?.add?.(evt as unknown as any) 
            } catch {
              // Silently ignore store errors
            }

            // Keep latest by created_at
            if (!latestEvent || evt.created_at > latestEvent.created_at) {
              latestEvent = evt
            }

            // Emit immediately on first event
            if (!firstEmitted) {
              firstEmitted = true
              const title = Helpers.getArticleTitle(evt) || 'Untitled Article'
              const image = Helpers.getArticleImage(evt)
              const summary = Helpers.getArticleSummary(evt)
              const published = Helpers.getArticlePublished(evt)
              setReaderContent({
                title,
                markdown: evt.content,
                image,
                summary,
                published,
                url: `nostr:${naddr}`
              })
              const dTag = evt.tags.find(t => t[0] === 'd')?.[1] || ''
              const articleCoordinate = `${evt.kind}:${evt.pubkey}:${dTag}`
              setCurrentArticleCoordinate(articleCoordinate)
              setCurrentArticleEventId(evt.id)
              setCurrentArticle?.(evt)
              setReaderLoading(false)
            }
          }
        })

        if (!mountedRef.current || currentRequestIdRef.current !== requestId) return

        // Finalize with newest version if it's newer than what we first rendered
        const finalEvent = (events.sort((a, b) => b.created_at - a.created_at)[0]) || latestEvent
        if (finalEvent) {
          const title = Helpers.getArticleTitle(finalEvent) || 'Untitled Article'
          const image = Helpers.getArticleImage(finalEvent)
          const summary = Helpers.getArticleSummary(finalEvent)
          const published = Helpers.getArticlePublished(finalEvent)
          setReaderContent({
            title,
            markdown: finalEvent.content,
            image,
            summary,
            published,
            url: `nostr:${naddr}`
          })

          const dTag = finalEvent.tags.find(t => t[0] === 'd')?.[1] || ''
          const articleCoordinate = `${finalEvent.kind}:${finalEvent.pubkey}:${dTag}`
          setCurrentArticleCoordinate(articleCoordinate)
          setCurrentArticleEventId(finalEvent.id)
          setCurrentArticle?.(finalEvent)
        } else {
          // As a last resort, fall back to the legacy helper (which includes cache)
          const article = await fetchArticleByNaddr(relayPool, naddr, false, settingsRef.current)
          if (!mountedRef.current || currentRequestIdRef.current !== requestId) return
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
        }

        // Fetch highlights after content is shown - ensure this happens reliably
        const fetchHighlightsForCurrentArticle = async () => {
          if (!mountedRef.current) return
          
          const le = latestEvent as NostrEvent | null
          const dTag = le ? (le.tags.find((t: string[]) => t[0] === 'd')?.[1] || '') : ''
          const coord = le && dTag ? `${le.kind}:${le.pubkey}:${dTag}` : undefined
          const eventId = le ? le.id : undefined
          
          if (coord && eventId) {
            console.log('Loading highlights for article:', coord, eventId)
            setHighlightsLoading(true)
            // Clear highlights that don't belong to this article coordinate
            setHighlights((prev) => {
              return prev.filter(h => {
                // Keep highlights that match this article coordinate or event ID
                return h.eventReference === coord || h.eventReference === eventId
              })
            })
            
            try {
              await fetchHighlightsForArticle(
                relayPool,
                coord,
                eventId,
                (highlight) => {
                  if (!mountedRef.current) return
                  if (currentRequestIdRef.current !== requestId) return
                  console.log('Received highlight:', highlight.id, highlight.content.substring(0, 50))
                  setHighlights((prev: Highlight[]) => {
                    if (prev.some((h: Highlight) => h.id === highlight.id)) return prev
                    const next = [highlight, ...prev]
                    return next.sort((a, b) => b.created_at - a.created_at)
                  })
                },
                settingsRef.current,
                false, // force
                eventStore || undefined
              )
              console.log('Finished loading highlights for article:', coord)
            } catch (err) {
              console.error('Failed to fetch highlights for article:', coord, err)
            }
          } else {
            console.log('No article coordinate or event ID available for highlights')
            // No article event to fetch highlights for - clear and don't show loading
            setHighlights([])
            setHighlightsLoading(false)
          }
        }
        
        // Always try to fetch highlights, even if we don't have the latest event yet
        try {
          await fetchHighlightsForCurrentArticle()
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          if (mountedRef.current && currentRequestIdRef.current === requestId) {
            setHighlightsLoading(false)
          }
        }
        
        // Add a fallback mechanism to ensure highlights are loaded
        // This helps with cases where the initial highlight loading might fail
        const fallbackTimeout = setTimeout(async () => {
          if (mountedRef.current && currentRequestIdRef.current === requestId) {
            console.log('Fallback: Attempting to load highlights again...')
            try {
              await fetchHighlightsForCurrentArticle()
            } catch (err) {
              console.error('Fallback highlight loading failed:', err)
            }
          }
        }, 2000) // Retry after 2 seconds
        
        // Clean up timeout if component unmounts or new article loads
        return () => {
          clearTimeout(fallbackTimeout)
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
    eventStore,
    previewData,
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
  
  // Additional effect to ensure highlights are loaded when article coordinate changes
  // This provides a backup mechanism in case the main loading doesn't work
  useEffect(() => {
    if (!relayPool || !eventStore) return
    
    const loadHighlightsIfNeeded = async () => {
      // Only load if we have a coordinate but no highlights are loading
      if (currentArticleCoordinate && currentArticleEventId && !highlightsLoading) {
        console.log('Backup: Loading highlights for coordinate:', currentArticleCoordinate)
        try {
          setHighlightsLoading(true)
          await fetchHighlightsForArticle(
            relayPool,
            currentArticleCoordinate,
            currentArticleEventId,
            (highlight) => {
              setHighlights((prev: Highlight[]) => {
                if (prev.some((h: Highlight) => h.id === highlight.id)) return prev
                const next = [highlight, ...prev]
                return next.sort((a, b) => b.created_at - a.created_at)
              })
            },
            settingsRef.current,
            false, // force
            eventStore
          )
        } catch (err) {
          console.error('Backup highlight loading failed:', err)
        } finally {
          setHighlightsLoading(false)
        }
      }
    }
    
    // Small delay to ensure the main loading has a chance to work first
    const timeout = setTimeout(loadHighlightsIfNeeded, 1000)
    
    return () => clearTimeout(timeout)
  }, [currentArticleCoordinate, currentArticleEventId, relayPool, eventStore, highlightsLoading])
}
