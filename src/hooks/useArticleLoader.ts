import { useEffect, useRef, useState, Dispatch, SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'
import { RelayPool } from 'applesauce-relay'
import type { IEventStore } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { Helpers } from 'applesauce-core'
import { queryEvents } from '../services/dataFetch'
import { fetchArticleByNaddr, getFromCache } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { ReadableContent } from '../services/readerService'
import { Highlight } from '../types/highlights'
import { NostrEvent } from 'nostr-tools'
import { UserSettings } from '../services/settingsService'
import { useDocumentTitle } from './useDocumentTitle'

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
  settings
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
  
  // Track the current article title for document title
  const [currentTitle, setCurrentTitle] = useState<string | undefined>()
  useDocumentTitle({ title: currentTitle })
  
  useEffect(() => {
    mountedRef.current = true
    
    if (!relayPool || !naddr) {
      console.log('[article-loader] Skipping load - missing relayPool or naddr', { hasRelayPool: !!relayPool, hasNaddr: !!naddr })
      return
    }
    
    console.log('[article-loader] Starting load for naddr:', naddr)
    
    // Synchronously check cache sources BEFORE starting async loading
    // This prevents showing loading skeletons when content is immediately available
    // Do this outside the async function for immediate execution
    try {
      console.log('[article-loader] Checking localStorage cache...')
      // Check localStorage cache first (synchronous)
      const cachedArticle = getFromCache(naddr)
      if (cachedArticle) {
        console.log('[article-loader] ✅ Cache HIT - loading from localStorage', {
          title: cachedArticle.title,
          hasMarkdown: !!cachedArticle.markdown,
          markdownLength: cachedArticle.markdown?.length
        })
        const title = cachedArticle.title || 'Untitled Article'
        setCurrentTitle(title)
        setReaderContent({
          title,
          markdown: cachedArticle.markdown,
          image: cachedArticle.image,
          summary: cachedArticle.summary,
          published: cachedArticle.published,
          url: `nostr:${naddr}`
        })
        const dTag = cachedArticle.event.tags.find(t => t[0] === 'd')?.[1] || ''
        const articleCoordinate = `${cachedArticle.event.kind}:${cachedArticle.author}:${dTag}`
        setCurrentArticleCoordinate(articleCoordinate)
        setCurrentArticleEventId(cachedArticle.event.id)
        setCurrentArticle?.(cachedArticle.event)
        setReaderLoading(false)
        setSelectedUrl(`nostr:${naddr}`)
        setIsCollapsed(true)
        
        // Store in EventStore for future lookups
        if (eventStore) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eventStore.add?.(cachedArticle.event as unknown as any)
          } catch {
            // Silently ignore store errors
          }
        }
        
        // Fetch highlights in background (don't block UI)
        if (mountedRef.current) {
          const dTag = cachedArticle.event.tags.find((t: string[]) => t[0] === 'd')?.[1] || ''
          const coord = dTag ? `${cachedArticle.event.kind}:${cachedArticle.author}:${dTag}` : undefined
          const eventId = cachedArticle.event.id
          
          if (coord && eventId && relayPool) {
            setHighlightsLoading(true)
            fetchHighlightsForArticle(
              relayPool,
              coord,
              eventId,
              (highlight) => {
                if (!mountedRef.current) return
                setHighlights((prev: Highlight[]) => {
                  if (prev.some((h: Highlight) => h.id === highlight.id)) return prev
                  const next = [highlight, ...prev]
                  return next.sort((a, b) => b.created_at - a.created_at)
                })
              },
              settings,
              false,
              eventStore || undefined
            ).then(() => {
              if (mountedRef.current) {
                setHighlightsLoading(false)
              }
            }).catch(() => {
              if (mountedRef.current) {
                setHighlightsLoading(false)
              }
            })
          }
        }
        
        // Return early - we have cached content, no need to query relays
        console.log('[article-loader] Returning early with cached content')
        return
      } else {
        console.log('[article-loader] ❌ Cache MISS - not found in localStorage')
      }
    } catch (err) {
      // If cache check fails, fall through to async loading
      console.warn('[article-loader] Cache check failed:', err)
    }
    
    const loadArticle = async () => {
      const requestId = ++currentRequestIdRef.current
      console.log('[article-loader] Starting async loadArticle function', { requestId })
      
      if (!mountedRef.current) {
        console.log('[article-loader] Component unmounted, aborting')
        return
      }
      
      setSelectedUrl(`nostr:${naddr}`)
      setIsCollapsed(true)
      
      // Don't clear highlights yet - let the smart filtering logic handle it
      // when we know the article coordinate
      setHighlightsLoading(false) // Don't show loading yet
      
      // Check eventStore for instant load (from bookmark cards, explore, etc.)
      // Cache was already checked synchronously above, so this only handles EventStore
      if (eventStore) {
        console.log('[article-loader] Checking EventStore...')
        try {
          // Decode naddr to get the coordinate
          const decoded = nip19.decode(naddr)
          if (decoded.type === 'naddr') {
            const pointer = decoded.data as AddressPointer
            const coordinate = `${pointer.kind}:${pointer.pubkey}:${pointer.identifier}`
            console.log('[article-loader] Looking for event with coordinate:', coordinate)
            const storedEvent = eventStore.getEvent?.(coordinate)
            if (storedEvent) {
              console.log('[article-loader] ✅ EventStore HIT - found event', {
                id: storedEvent.id,
                kind: storedEvent.kind,
                hasContent: !!storedEvent.content,
                contentLength: storedEvent.content?.length
              })
              const title = Helpers.getArticleTitle(storedEvent) || 'Untitled Article'
              setCurrentTitle(title)
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
              
              // If we found the content in EventStore, we can return early
              // This prevents unnecessary relay queries when offline
              console.log('[article-loader] Returning early with EventStore content')
              return
            } else {
              console.log('[article-loader] ❌ EventStore MISS - no event found for coordinate:', coordinate)
            }
          }
        } catch (err) {
          // Ignore store errors, fall through to relay query
          console.warn('[article-loader] EventStore check failed:', err)
        }
      } else {
        console.log('[article-loader] No EventStore available, skipping check')
      }

      // At this point, we've checked EventStore and cache - neither had content
      // Only show loading skeleton if we also don't have preview data
      if (previewData) {
        console.log('[article-loader] Using preview data (no skeleton)', { title: previewData.title })
        // If we have preview data from navigation, show it immediately (no skeleton!)
        setCurrentTitle(previewData.title)
        setReaderContent({
          title: previewData.title,
          markdown: '', // Will be loaded from relay
          image: previewData.image,
          summary: previewData.summary,
          published: previewData.published,
          url: `nostr:${naddr}`
        })
        setReaderLoading(false) // Turn off loading immediately - we have the preview!
      } else {
        // No cache, no EventStore, no preview data - need to load from relays
        console.log('[article-loader] ⚠️ No cache, EventStore, or preview - showing loading skeleton and querying relays')
        setReaderLoading(true)
        setReaderContent(undefined)
      }
      
      try {
        console.log('[article-loader] Querying relays for article...')
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
        console.log('[article-loader] Relay query filter:', filter)

        let firstEmitted = false
        let latestEvent: NostrEvent | null = null

        // Stream local-first via queryEvents; rely on EOSE (no timeouts)
        console.log('[article-loader] Starting queryEvents...')
        const events = await queryEvents(relayPool, filter, {
          onEvent: (evt) => {
            if (!mountedRef.current) {
              console.log('[article-loader] Component unmounted during event stream, ignoring')
              return
            }
            if (currentRequestIdRef.current !== requestId) {
              console.log('[article-loader] Request ID mismatch, ignoring event', {
                currentRequestId: currentRequestIdRef.current,
                eventRequestId: requestId
              })
              return
            }

            console.log('[article-loader] 📨 Received event from relay', {
              id: evt.id,
              kind: evt.kind,
              created_at: evt.created_at,
              contentLength: evt.content?.length,
              isFirst: !firstEmitted
            })

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
              console.log('[article-loader] ✅ First event received - updating UI immediately')
              firstEmitted = true
              const title = Helpers.getArticleTitle(evt) || 'Untitled Article'
              setCurrentTitle(title)
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
              console.log('[article-loader] UI updated with first event')
            }
          }
        })

        console.log('[article-loader] QueryEvents completed', {
          eventCount: events.length,
          hasLatestEvent: !!latestEvent,
          mounted: mountedRef.current,
          requestIdMatch: currentRequestIdRef.current === requestId
        })

        if (!mountedRef.current || currentRequestIdRef.current !== requestId) {
          console.log('[article-loader] Component unmounted or request ID changed, aborting')
          return
        }

        // Finalize with newest version if it's newer than what we first rendered
        const finalEvent = (events.sort((a, b) => b.created_at - a.created_at)[0]) || latestEvent
        if (finalEvent) {
          console.log('[article-loader] ✅ Finalizing with event', {
            id: finalEvent.id,
            created_at: finalEvent.created_at,
            wasFirstEmitted: firstEmitted
          })
          const title = Helpers.getArticleTitle(finalEvent) || 'Untitled Article'
          setCurrentTitle(title)
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
          console.log('[article-loader] ✅ Finalized with event from relays')
        } else {
          // As a last resort, fall back to the legacy helper (which includes cache)
          console.log('[article-loader] ⚠️ No events from relays, falling back to fetchArticleByNaddr')
          const article = await fetchArticleByNaddr(relayPool, naddr, false, settingsRef.current)
          console.log('[article-loader] fetchArticleByNaddr result:', {
            hasArticle: !!article,
            title: article?.title,
            hasMarkdown: !!article?.markdown
          })
          if (!mountedRef.current || currentRequestIdRef.current !== requestId) return
          setCurrentTitle(article.title)
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

        // Fetch highlights after content is shown
        try {
          if (!mountedRef.current) return
          
          const le = latestEvent as NostrEvent | null
          const dTag = le ? (le.tags.find((t: string[]) => t[0] === 'd')?.[1] || '') : ''
          const coord = le && dTag ? `${le.kind}:${le.pubkey}:${dTag}` : undefined
          const eventId = le ? le.id : undefined
          
          if (coord && eventId) {
            setHighlightsLoading(true)
            // Clear highlights that don't belong to this article coordinate
            setHighlights((prev) => {
              return prev.filter(h => {
                // Keep highlights that match this article coordinate or event ID
                return h.eventReference === coord || h.eventReference === eventId
              })
            })
            await fetchHighlightsForArticle(
              relayPool,
              coord,
              eventId,
              (highlight) => {
                if (!mountedRef.current) return
                if (currentRequestIdRef.current !== requestId) return
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
          } else {
            // No article event to fetch highlights for - clear and don't show loading
            setHighlights([])
            setHighlightsLoading(false)
          }
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
    // Dependencies intentionally excluded to prevent re-renders when relay/eventStore state changes
    // This fixes the loading skeleton appearing when going offline (flight mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    naddr,
    previewData
  ])
}
