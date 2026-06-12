import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { BlogPostPreview } from '../services/exploreService'
import { Highlight } from '../types/highlights'
import { nostrverseHighlightsController } from '../services/nostrverseHighlightsController'
import { highlightsController } from '../services/highlightsController'
import { nostrverseWritingsController } from '../services/nostrverseWritingsController'
import { writingsController } from '../services/writingsController'
import { readingProgressController } from '../services/readingProgressController'
import { contactsController } from '../services/contactsController'
import { dedupeWritingsByReplaceable } from '../utils/dedupe'

export const useExploreControllers = (
  relayPool: RelayPool,
  eventStore: IEventStore,
  activeAccount: { pubkey: string } | undefined,
  refreshTrigger: number,
  setLoading: Dispatch<SetStateAction<boolean>>
) => {
  const [blogPosts, setBlogPosts] = useState<BlogPostPreview[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [myHighlights, setMyHighlights] = useState<Highlight[]>([])
  const [readingProgressMap, setReadingProgressMap] = useState<Map<string, number>>(new Map())
  
  const hasHydratedRef = useRef(false)
  const lastReadingProgressPubkeyRef = useRef<string | null>(null)

  // Subscribe to highlights controller
  useEffect(() => {
    const seed = highlightsController.getHighlights()
    if (seed) setMyHighlights(seed)
    const unsubHighlights = highlightsController.onHighlights(setMyHighlights)
    return () => {
      unsubHighlights()
    }
  }, [])

  // Subscribe to contacts stream and mirror into local state
  // Reset when account changes or is removed
  useEffect(() => {
    if (!activeAccount?.pubkey) {
      setFollowedPubkeys(new Set())
      return
    }
    const unsubscribe = contactsController.onContacts((contacts) => {
      setFollowedPubkeys(new Set(contacts))
    })
    return () => {
      unsubscribe()
      setFollowedPubkeys(new Set())
    }
  }, [activeAccount?.pubkey])

  // Ensure contacts controller is started for the active account (non-blocking)
  useEffect(() => {
    if (relayPool && activeAccount?.pubkey) {
      contactsController.start({ relayPool, pubkey: activeAccount.pubkey }).catch((err) => {
        console.warn('[Explore] Failed to start contacts controller:', err)
      })
    }
  }, [relayPool, activeAccount?.pubkey])

  // Subscribe to nostrverse highlights controller for global stream
  useEffect(() => {
    const apply = (incoming: Highlight[]) => {
      setHighlights(prev => {
        const byId = new Map(prev.map(h => [h.id, h]))
        for (const h of incoming) byId.set(h.id, h)
        return Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at)
      })
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true
        setLoading(false)
      }
    }
    // seed immediately
    apply(nostrverseHighlightsController.getHighlights())
    const unsub = nostrverseHighlightsController.onHighlights(apply)
    return () => unsub()
  }, [setLoading])

  // Subscribe to nostrverse writings controller for global stream
  useEffect(() => {
    const apply = (incoming: BlogPostPreview[]) => {
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...incoming])
        return merged.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true
        setLoading(false)
      }
    }
    apply(nostrverseWritingsController.getWritings())
    const unsub = nostrverseWritingsController.onWritings(apply)
    return () => unsub()
  }, [setLoading])

  // Subscribe to writings controller for "mine" posts and seed immediately
  useEffect(() => {
    // Seed from controller's current state
    const seed = writingsController.getWritings()
    if (seed.length > 0) {
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...seed])
        return merged.sort((a, b) => {
          const timeA = a.published || a.event.created_at
          const timeB = b.published || b.event.created_at
          return timeB - timeA
        })
      })
    }

    // Stream updates
    const unsub = writingsController.onWritings((posts) => {
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...posts])
        return merged.sort((a, b) => {
          const timeA = a.published || a.event.created_at
          const timeB = b.published || b.event.created_at
          return timeB - timeA
        })
      })
    })

    return () => unsub()
  }, [])
  
  // Subscribe to reading progress controller
  useEffect(() => {
    // Get initial state immediately
    const initialMap = readingProgressController.getProgressMap()
    setReadingProgressMap(initialMap)
    
    // Subscribe to updates
    const unsubProgress = readingProgressController.onProgress((newMap) => {
      setReadingProgressMap(newMap)
    })
    
    return () => {
      unsubProgress()
    }
  }, [])
  
  // Load reading progress data when logged in
  useEffect(() => {
    const pubkey = activeAccount?.pubkey ?? null

    if (!pubkey) {
      lastReadingProgressPubkeyRef.current = null
      readingProgressController.reset()
      setReadingProgressMap(new Map())
      return
    }

    if (lastReadingProgressPubkeyRef.current !== pubkey) {
      lastReadingProgressPubkeyRef.current = pubkey

      if (readingProgressController.isLoadedFor(pubkey)) {
        setReadingProgressMap(readingProgressController.getProgressMap())
      } else {
        readingProgressController.reset()
        setReadingProgressMap(new Map())
      }
    }
    
    readingProgressController.start({
      relayPool,
      eventStore,
      pubkey,
      force: refreshTrigger > 0
    }).catch((err) => {
      console.warn('[Explore] Failed to start reading progress controller:', err)
    })
  }, [activeAccount?.pubkey, relayPool, eventStore, refreshTrigger])

  return {
    blogPosts,
    setBlogPosts,
    highlights,
    setHighlights,
    followedPubkeys,
    myHighlights,
    readingProgressMap,
    hasHydratedRef
  }
}
