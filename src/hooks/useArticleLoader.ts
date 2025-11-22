import { useEffect, useRef, useState, Dispatch, SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'
import { RelayPool } from 'applesauce-relay'
import type { IEventStore } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { Helpers } from 'applesauce-core'
import { queryEvents } from '../services/dataFetch'
import { fetchArticleByNaddr, getFromCache, saveToCache } from '../services/articleService'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { preloadImage } from './useImageCache'
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

interface NavigationState {
  previewData?: PreviewData
  articleCoordinate?: string
  eventId?: string
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
  
  // Extract navigation state (from blog post cards)
  const navState = (location.state as NavigationState | null) || {}
  const previewData = navState.previewData
  const navArticleCoordinate = navState.articleCoordinate
  const navEventId = navState.eventId
  
  // Track the current article title for document title
  const [currentTitle, setCurrentTitle] = useState<string | undefined>()
  useDocumentTitle({ title: currentTitle })
  
  useEffect(() => {
    mountedRef.current = true
    
    // First check: naddr is required
    if (!naddr) {
      setReaderContent(undefined)
      return
    }
    
    // Clear readerContent immediately to prevent showing stale content from previous article
    // This ensures images from previous articles don't flash briefly
    setReaderContent(undefined)
    
    // FIRST: Check navigation state for article coordinate/eventId (from Explore)
    // This allows immediate hydration when coming from Explore without refetching
    let foundInNavState = false
    if (eventStore && (navArticleCoordinate || navEventId)) {
      try {
        let storedEvent: NostrEvent | undefined
        
        // Try coordinate first (most reliable for replaceable events)
        if (navArticleCoordinate) {
          storedEvent = eventStore.getEvent?.(navArticleCoordinate) as NostrEvent | undefined
        }
        
        // Fallback to eventId if coordinate lookup failed
        if (!storedEvent && navEventId) {
          // Note: eventStore.getEvent might not support eventId lookup directly
          // We'll decode naddr to get coordinate as fallback
          try {
            const decoded = nip19.decode(naddr)
            if (decoded.type === 'naddr') {
              const pointer = decoded.data as AddressPointer
              const coordinate = `${pointer.kind}:${pointer.pubkey}:${pointer.identifier}`
              storedEvent = eventStore.getEvent?.(coordinate) as NostrEvent | undefined
            }
          } catch {
            // Ignore decode errors
          }
        }
        
        if (storedEvent) {
          foundInNavState = true
          const title = Helpers.getArticleTitle(storedEvent) || previewData?.title || 'Untitled Article'
          setCurrentTitle(title)
          const image = Helpers.getArticleImage(storedEvent) || previewData?.image
          const summary = Helpers.getArticleSummary(storedEvent) || previewData?.summary
          const published = Helpers.getArticlePublished(storedEvent) || previewData?.published
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
          setSelectedUrl(`nostr:${naddr}`)
          setIsCollapsed(true)
          
          // Preload image if available
          if (image) {
            preloadImage(image)
          }
          
          // Fetch highlights in background if relayPool is available
          if (relayPool) {
            const coord = dTag ? `${storedEvent.kind}:${storedEvent.pubkey}:${dTag}` : undefined
            const eventId = storedEvent.id
            
            if (coord && eventId) {
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
          
          // Start background query to check for newer replaceable version
          // but don't block UI - we already have content
          if (relayPool) {
            const backgroundRequestId = ++currentRequestIdRef.current
            const originalCreatedAt = storedEvent.created_at
            
            // Fire and forget background fetch
            ;(async () => {
              try {
                const decoded = nip19.decode(naddr)
                if (decoded.type !== 'naddr') return
                const pointer = decoded.data as AddressPointer
                const filter = {
                  kinds: [pointer.kind],
                  authors: [pointer.pubkey],
                  '#d': [pointer.identifier]
                }
                
                const events = await queryEvents(relayPool, filter, {
                  onEvent: (evt) => {
                    if (!mountedRef.current || currentRequestIdRef.current !== backgroundRequestId) return
                    
                    // Store in event store
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      eventStore?.add?.(evt as unknown as any)
                    } catch {
                      // Ignore store errors
                    }
                    
                    // Only update if this is a newer version than what we loaded
                    if (evt.created_at > originalCreatedAt) {
                      const title = Helpers.getArticleTitle(evt) || 'Untitled Article'
                      const image = Helpers.getArticleImage(evt)
                      const summary = Helpers.getArticleSummary(evt)
                      const published = Helpers.getArticlePublished(evt)
                      
                      setCurrentTitle(title)
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
                      
                      // Update cache
                      const articleContent = {
                        title,
                        markdown: evt.content,
                        image,
                        summary,
                        published,
                        author: evt.pubkey,
                        event: evt
                      }
                      saveToCache(naddr, articleContent, settings)
                    }
                  }
                })
              } catch (err) {
                // Silently ignore background fetch errors - we already have content
                console.warn('[article-loader] Background fetch failed:', err)
              }
            })()
          }
          
          // Return early - we have content from navigation state
          return
        }
      } catch (err) {
        // If navigation state lookup fails, fall through to cache/EventStore
        console.warn('[article-loader] Navigation state lookup failed:', err)
      }
    }
    
    // Synchronously check cache sources BEFORE checking relayPool
    // This prevents showing loading skeletons when content is immediately available
    // and fixes the race condition where relayPool isn't ready yet
    let foundInCache = false
    try {
      // Check localStorage cache first (synchronous, doesn't need relayPool)
      const cachedArticle = getFromCache(naddr)
      if (cachedArticle) {
        foundInCache = true
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
        
        // Preload image if available to ensure it's cached by Service Worker
        // This ensures images are available when offline
        if (cachedArticle.image) {
          preloadImage(cachedArticle.image)
        }
        
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
        // Only fetch highlights if relayPool is available
        if (mountedRef.current && relayPool) {
          const dTag = cachedArticle.event.tags.find((t: string[]) => t[0] === 'd')?.[1] || ''
          const coord = dTag ? `${cachedArticle.event.kind}:${cachedArticle.author}:${dTag}` : undefined
          const eventId = cachedArticle.event.id
          
          if (coord && eventId) {
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
        return
      }
    } catch (err) {
      // If cache check fails, fall through to async loading
      console.warn('[article-loader] Cache check failed:', err)
    }
    
    // Check EventStore synchronously (also doesn't need relayPool)
    let foundInEventStore = false
    if (eventStore && !foundInCache && !foundInNavState) {
      try {
        // Decode naddr to get the coordinate
        const decoded = nip19.decode(naddr)
        if (decoded.type === 'naddr') {
          const pointer = decoded.data as AddressPointer
          const coordinate = `${pointer.kind}:${pointer.pubkey}:${pointer.identifier}`
          const storedEvent = eventStore.getEvent?.(coordinate)
          if (storedEvent) {
            foundInEventStore = true
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
            setSelectedUrl(`nostr:${naddr}`)
            setIsCollapsed(true)
            
            // Fetch highlights in background if relayPool is available
            if (relayPool) {
              const coord = dTag ? `${storedEvent.kind}:${storedEvent.pubkey}:${dTag}` : undefined
              const eventId = storedEvent.id
              
              if (coord && eventId) {
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
            
            // Return early - we have EventStore content, no need to query relays yet
            // But we might want to fetch from relays in background if relayPool becomes available
            return
          }
        }
      } catch (err) {
        // Ignore store errors, fall through to relay query
        console.warn('[article-loader] EventStore check failed:', err)
      }
    }
    
    // Only return early if we have no content AND no relayPool to fetch from
    if (!relayPool && !foundInCache && !foundInEventStore && !foundInNavState) {
      setReaderLoading(true)
      setReaderContent(undefined)
      return
    }
    
    // If we have relayPool, proceed with async loading
    if (!relayPool) {
      return
    }
    
    const loadArticle = async () => {
      const requestId = ++currentRequestIdRef.current
      
      if (!mountedRef.current) {
        return
      }
      
      setSelectedUrl(`nostr:${naddr}`)
      setIsCollapsed(true)
      
      // Don't clear highlights yet - let the smart filtering logic handle it
      // when we know the article coordinate
      setHighlightsLoading(false) // Don't show loading yet
      
      // Note: Cache and EventStore were already checked synchronously above
      // This async function only runs if we need to fetch from relays

      // At this point, we've checked EventStore and cache - neither had content
      // Only show loading skeleton if we also don't have preview data
      if (previewData) {
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
        
        // Don't preload image here - it should already be cached from BlogPostCard
        // Preloading again would be redundant and could cause unnecessary network requests
      } else {
        // No cache, no EventStore, no preview data - need to load from relays
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

        // Stream local-first via queryEvents; rely on EOSE (no timeouts)
        const events = await queryEvents(relayPool, filter, {
          onEvent: (evt) => {
            if (!mountedRef.current) {
              return
            }
            if (currentRequestIdRef.current !== requestId) {
              return
            }

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
              
              setCurrentTitle(title)
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
              
              // Save to cache immediately when we get the first event
              // Don't wait for queryEvents to complete in case it hangs
              const articleContent = {
                title,
                markdown: evt.content,
                image,
                summary,
                published,
                author: evt.pubkey,
                event: evt
              }
              saveToCache(naddr, articleContent, settings)
              
              // Preload image to ensure it's cached by Service Worker
              if (image) {
                preloadImage(image)
              }
            }
          }
        })

        if (!mountedRef.current || currentRequestIdRef.current !== requestId) {
          return
        }

        // Finalize with newest version if it's newer than what we first rendered
        const finalEvent = (events.sort((a, b) => b.created_at - a.created_at)[0]) || latestEvent
        if (finalEvent) {
          const title = Helpers.getArticleTitle(finalEvent) || 'Untitled Article'
          const image = Helpers.getArticleImage(finalEvent)
          const summary = Helpers.getArticleSummary(finalEvent)
          const published = Helpers.getArticlePublished(finalEvent)
          
          setCurrentTitle(title)
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
          
          // Save to cache for future loads (if we haven't already saved from first event)
          // Only save if this is a different/newer event than what we first rendered
          // Note: We already saved from first event, so only save if this is different
          if (!firstEmitted) {
            // First event wasn't emitted, so save now
            const articleContent = {
              title,
              markdown: finalEvent.content,
              image,
              summary,
              published,
              author: finalEvent.pubkey,
              event: finalEvent
            }
            saveToCache(naddr, articleContent)
          }
        } else {
          // As a last resort, fall back to the legacy helper (which includes cache)
          const article = await fetchArticleByNaddr(relayPool, naddr, false, settingsRef.current)
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
    // Include relayPool in dependencies so effect re-runs when it becomes available
    // This fixes the race condition where articles don't load on direct navigation
    // We guard against unnecessary re-renders by checking cache/EventStore first
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    naddr,
    previewData,
    relayPool
  ])
}
