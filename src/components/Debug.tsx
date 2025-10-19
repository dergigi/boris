import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { Accounts } from 'applesauce-accounts'
import { NostrConnectSigner } from 'applesauce-signers'
import { RelayPool } from 'applesauce-relay'
import { Helpers, IEventStore } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { getDefaultBunkerPermissions } from '../services/nostrConnect'
import { DebugBus, type DebugLogEntry } from '../utils/debugBus'
import ThreePaneLayout from './ThreePaneLayout'
import { KINDS } from '../config/kinds'
import type { NostrEvent } from '../services/bookmarkHelpers'
import { Bookmark } from '../types/bookmarks'
import { useBookmarksUI } from '../hooks/useBookmarksUI'
import { useSettings } from '../hooks/useSettings'
import { fetchHighlights, fetchHighlightsFromAuthors } from '../services/highlightService'
import { contactsController } from '../services/contactsController'
import { writingsController } from '../services/writingsController'
import { fetchBlogPostsFromAuthors, BlogPostPreview } from '../services/exploreService'

const defaultPayload = 'The quick brown fox jumps over the lazy dog.'

interface DebugProps {
  relayPool: RelayPool | null
  eventStore: IEventStore | null
  bookmarks: Bookmark[]
  bookmarksLoading: boolean
  onRefreshBookmarks: () => Promise<void>
  onLogout: () => void
}

const Debug: React.FC<DebugProps> = ({ 
  relayPool, 
  eventStore,
  bookmarks, 
  bookmarksLoading, 
  onRefreshBookmarks,
  onLogout 
}) => {
  const navigate = useNavigate()
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  
  const { settings, saveSettings } = useSettings({
    relayPool,
    eventStore: eventStore!,
    pubkey: activeAccount?.pubkey,
    accountManager
  })
  
  const {
    isMobile,
    isCollapsed,
    setIsCollapsed,
    viewMode,
    setViewMode
  } = useBookmarksUI({ settings })
  const [payload, setPayload] = useState<string>(defaultPayload)
  const [cipher44, setCipher44] = useState<string>('')
  const [cipher04, setCipher04] = useState<string>('')
  const [plain44, setPlain44] = useState<string>('')
  const [plain04, setPlain04] = useState<string>('')
  const [tEncrypt44, setTEncrypt44] = useState<number | null>(null)
  const [tEncrypt04, setTEncrypt04] = useState<number | null>(null)
  const [tDecrypt44, setTDecrypt44] = useState<number | null>(null)
  const [tDecrypt04, setTDecrypt04] = useState<number | null>(null)
  const [logs, setLogs] = useState<DebugLogEntry[]>(DebugBus.snapshot())
  const [debugEnabled, setDebugEnabled] = useState<boolean>(() => localStorage.getItem('debug') === '*')
  
  // Bunker login state
  const [bunkerUri, setBunkerUri] = useState<string>('')
  const [isBunkerLoading, setIsBunkerLoading] = useState<boolean>(false)
  const [bunkerError, setBunkerError] = useState<string | null>(null)
  
  // Bookmark loading state
  const [bookmarkEvents, setBookmarkEvents] = useState<NostrEvent[]>([])
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false)
  const [bookmarkStats, setBookmarkStats] = useState<{ public: number; private: number } | null>(null)
  const [tLoadBookmarks, setTLoadBookmarks] = useState<number | null>(null)
  const [tDecryptBookmarks, setTDecryptBookmarks] = useState<number | null>(null)
  const [tFirstBookmark, setTFirstBookmark] = useState<number | null>(null)
  
  // Individual event decryption results
  const [decryptedEvents, setDecryptedEvents] = useState<Map<string, { public: number; private: number }>>(new Map())
  
  // Highlight loading state
  const [highlightMode, setHighlightMode] = useState<'article' | 'url' | 'author'>('author')
  const [highlightArticleCoord, setHighlightArticleCoord] = useState<string>('')
  const [highlightUrl, setHighlightUrl] = useState<string>('')
  const [highlightAuthor, setHighlightAuthor] = useState<string>('')
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false)
  const [highlightEvents, setHighlightEvents] = useState<NostrEvent[]>([])
  const [tLoadHighlights, setTLoadHighlights] = useState<number | null>(null)
  const [tFirstHighlight, setTFirstHighlight] = useState<number | null>(null)
  
  // Writings loading state
  const [isLoadingWritings, setIsLoadingWritings] = useState(false)
  const [writingPosts, setWritingPosts] = useState<BlogPostPreview[]>([])
  const [tLoadWritings, setTLoadWritings] = useState<number | null>(null)
  const [tFirstWriting, setTFirstWriting] = useState<number | null>(null)
  
  // Live timing state
  const [liveTiming, setLiveTiming] = useState<{
    nip44?: { type: 'encrypt' | 'decrypt'; startTime: number }
    nip04?: { type: 'encrypt' | 'decrypt'; startTime: number }
    loadBookmarks?: { startTime: number }
    decryptBookmarks?: { startTime: number }
    loadHighlights?: { startTime: number }
  }>({})
  
  // Web of Trust state
  const [friendsPubkeys, setFriendsPubkeys] = useState<Set<string>>(new Set())
  const [friendsButtonLoading, setFriendsButtonLoading] = useState(false)

  useEffect(() => {
    return DebugBus.subscribe((e) => setLogs(prev => [...prev, e].slice(-300)))
  }, [])

  // Live timer effect - triggers re-renders for live timing updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update live timing display
      setLiveTiming(prev => prev)
    }, 16) // ~60fps for smooth updates
    return () => clearInterval(interval)
  }, [])

  const signer = useMemo(() => (activeAccount as unknown as { signer?: unknown })?.signer, [activeAccount])
  const pubkey = (activeAccount as unknown as { pubkey?: string })?.pubkey

  const hasNip04 = typeof (signer as { nip04?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip04?.encrypt === 'function'
  const hasNip44 = typeof (signer as { nip44?: { encrypt?: unknown; decrypt?: unknown } } | undefined)?.nip44?.encrypt === 'function'

  const getKindName = (kind: number): string => {
    switch (kind) {
      case KINDS.ListSimple: return 'Simple List (10003)'
      case KINDS.ListReplaceable: return 'Replaceable List (30003)'
      case KINDS.List: return 'List (30001)'
      case KINDS.WebBookmark: return 'Web Bookmark (39701)'
      default: return `Kind ${kind}`
    }
  }

  const getEventSize = (evt: NostrEvent): number => {
    const content = evt.content || ''
    const tags = JSON.stringify(evt.tags || [])
    return content.length + tags.length
  }

  const hasEncryptedContent = (evt: NostrEvent): boolean => {
    // Check for NIP-44 encrypted content (detected by Helpers)
    if (Helpers.hasHiddenContent(evt)) return true
    
    // Check for NIP-04 encrypted content (base64 with ?iv= suffix)
    if (evt.content && evt.content.includes('?iv=')) return true
    
    // Check for encrypted tags
    if (Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt)) return true
    
    return false
  }

  const getBookmarkCount = (evt: NostrEvent): { public: number; private: number } => {
    const publicTags = (evt.tags || []).filter((t: string[]) => t[0] === 'e' || t[0] === 'a')
    const hasEncrypted = hasEncryptedContent(evt)
    return {
      public: publicTags.length,
      private: hasEncrypted ? 1 : 0 // Can't know exact count until decrypted
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const getEventKey = (evt: NostrEvent): string => {
    if (evt.kind === 30003 || evt.kind === 30001) {
      // Replaceable: kind:pubkey:dtag
      const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
      return `${evt.kind}:${evt.pubkey}:${dTag}`
    } else if (evt.kind === 10003) {
      // Simple list: kind:pubkey
      return `${evt.kind}:${evt.pubkey}`
    }
    // Web bookmarks: use event id (no deduplication)
    return evt.id
  }

  const doEncrypt = async (mode: 'nip44' | 'nip04') => {
    if (!signer || !pubkey) return
    try {
      const api = (signer as { [key: string]: { encrypt: (pubkey: string, message: string) => Promise<string> } })[mode]
      DebugBus.info('debug', `encrypt start ${mode}`, { pubkey, len: payload.length })
      
      // Start live timing
      const start = performance.now()
      setLiveTiming(prev => ({ ...prev, [mode]: { type: 'encrypt', startTime: start } }))
      
      const cipher = await api.encrypt(pubkey, payload)
      const ms = Math.round(performance.now() - start)
      
      // Stop live timing
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      
      DebugBus.info('debug', `encrypt done ${mode}`, { len: typeof cipher === 'string' ? cipher.length : -1, ms })
      if (mode === 'nip44') setCipher44(cipher)
      else setCipher04(cipher)
      if (mode === 'nip44') setTEncrypt44(ms)
      else setTEncrypt04(ms)
    } catch (e) {
      // Stop live timing on error
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      DebugBus.error('debug', `encrypt error ${mode}`, e instanceof Error ? e.message : String(e))
    }
  }

  const doDecrypt = async (mode: 'nip44' | 'nip04') => {
    if (!signer || !pubkey) return
    try {
      const api = (signer as { [key: string]: { decrypt: (pubkey: string, ciphertext: string) => Promise<string> } })[mode]
      const cipher = mode === 'nip44' ? cipher44 : cipher04
      if (!cipher) {
        DebugBus.warn('debug', `no cipher to decrypt for ${mode}`)
        return
      }
      DebugBus.info('debug', `decrypt start ${mode}`, { len: cipher.length })
      
      // Start live timing
      const start = performance.now()
      setLiveTiming(prev => ({ ...prev, [mode]: { type: 'decrypt', startTime: start } }))
      
      const plain = await api.decrypt(pubkey, cipher)
      const ms = Math.round(performance.now() - start)
      
      // Stop live timing
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      
      DebugBus.info('debug', `decrypt done ${mode}`, { len: typeof plain === 'string' ? plain.length : -1, ms })
      if (mode === 'nip44') setPlain44(String(plain))
      else setPlain04(String(plain))
      if (mode === 'nip44') setTDecrypt44(ms)
      else setTDecrypt04(ms)
    } catch (e) {
      // Stop live timing on error
      setLiveTiming(prev => ({ ...prev, [mode]: undefined }))
      DebugBus.error('debug', `decrypt error ${mode}`, e instanceof Error ? e.message : String(e))
    }
  }

  const toggleDebug = () => {
    const next = !debugEnabled
    setDebugEnabled(next)
    if (next) localStorage.setItem('debug', '*')
    else localStorage.removeItem('debug')
  }

  const handleLoadBookmarks = async () => {
    if (!relayPool || !activeAccount) {
      DebugBus.warn('debug', 'Cannot load bookmarks: missing relayPool or activeAccount')
      return
    }

    try {
      setIsLoadingBookmarks(true)
      setBookmarkStats(null)
      setBookmarkEvents([]) // Clear existing events
      setDecryptedEvents(new Map())
      setTFirstBookmark(null)
      DebugBus.info('debug', 'Loading bookmark events...')

      // Start timing
      const start = performance.now()
      let firstEventTime: number | null = null
      setLiveTiming(prev => ({ ...prev, loadBookmarks: { startTime: start } }))

      // Import controller at runtime to avoid circular dependencies
      const { bookmarkController } = await import('../services/bookmarkController')
      
      // Subscribe to raw events for Debug UI display
      const unsubscribeRaw = bookmarkController.onRawEvent((evt) => {
        // Track time to first event
        if (firstEventTime === null) {
          firstEventTime = performance.now() - start
          setTFirstBookmark(Math.round(firstEventTime))
        }
        
        // Add event immediately with live deduplication
        setBookmarkEvents(prev => {
          const key = getEventKey(evt)
          const existingIdx = prev.findIndex(e => getEventKey(e) === key)
          
          if (existingIdx >= 0) {
            const existing = prev[existingIdx]
            if ((evt.created_at || 0) > (existing.created_at || 0)) {
              const newEvents = [...prev]
              newEvents[existingIdx] = evt
              return newEvents
            }
            return prev
          }
          
          return [...prev, evt]
        })
      })

      // Subscribe to decrypt complete events for Debug UI display
      const unsubscribeDecrypt = bookmarkController.onDecryptComplete((eventId, publicCount, privateCount) => {
        setDecryptedEvents(prev => new Map(prev).set(eventId, { 
          public: publicCount, 
          private: privateCount 
        }))
      })

      // Start the controller (triggers app bookmark population too)
      bookmarkController.reset()
      await bookmarkController.start({ relayPool, activeAccount, accountManager })
      
      // Clean up subscriptions
      unsubscribeRaw()
      unsubscribeDecrypt()

      const ms = Math.round(performance.now() - start)
      setLiveTiming(prev => ({ ...prev, loadBookmarks: undefined }))
      setTLoadBookmarks(ms)

      DebugBus.info('debug', `Loaded bookmark events`, { ms })
    } catch (error) {
      setLiveTiming(prev => ({ ...prev, loadBookmarks: undefined }))
      DebugBus.error('debug', 'Failed to load bookmarks', error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoadingBookmarks(false)
    }
  }

  const handleClearBookmarks = () => {
    setBookmarkEvents([])
    setBookmarkStats(null)
    setTLoadBookmarks(null)
    setTDecryptBookmarks(null)
    setTFirstBookmark(null)
    setDecryptedEvents(new Map())
    DebugBus.info('debug', 'Cleared bookmark data')
  }

  const handleLoadHighlights = async () => {
    if (!relayPool) {
      DebugBus.warn('debug', 'Cannot load highlights: missing relayPool')
      return
    }

    // Default to logged-in user's highlights if no specific query provided
    const getValue = () => {
      if (highlightMode === 'article') return highlightArticleCoord.trim()
      if (highlightMode === 'url') return highlightUrl.trim()
      const authorValue = highlightAuthor.trim()
      return authorValue || pubkey || ''
    }

    const value = getValue()
    if (!value) {
      DebugBus.warn('debug', 'Please provide a value to query or log in')
      return
    }

    try {
      setIsLoadingHighlights(true)
      setHighlightEvents([])
      setTFirstHighlight(null)
      DebugBus.info('debug', `Loading highlights (${highlightMode}: ${value})...`)

      const start = performance.now()
      setLiveTiming(prev => ({ ...prev, loadHighlights: { startTime: start } }))

      let firstEventTime: number | null = null
      const seenIds = new Set<string>()

      // Import highlight services
      const { queryEvents } = await import('../services/dataFetch')
      const { KINDS } = await import('../config/kinds')

      // Build filter based on mode
      let filter: { kinds: number[]; '#a'?: string[]; '#r'?: string[]; authors?: string[] }
      if (highlightMode === 'article') {
        filter = { kinds: [KINDS.Highlights], '#a': [value] }
      } else if (highlightMode === 'url') {
        filter = { kinds: [KINDS.Highlights], '#r': [value] }
      } else {
        filter = { kinds: [KINDS.Highlights], authors: [value] }
      }

      const events = await queryEvents(relayPool, filter, {
        onEvent: (evt) => {
          if (seenIds.has(evt.id)) return
          seenIds.add(evt.id)

          if (firstEventTime === null) {
            firstEventTime = performance.now() - start
            setTFirstHighlight(Math.round(firstEventTime))
          }

          setHighlightEvents(prev => [...prev, evt])
        }
      })

      const elapsed = Math.round(performance.now() - start)
      setTLoadHighlights(elapsed)
      setLiveTiming(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const { loadHighlights, ...rest } = prev
        return rest
      })

      DebugBus.info('debug', `Loaded ${events.length} highlight events in ${elapsed}ms`)
    } catch (err) {
      console.error('Failed to load highlights:', err)
      DebugBus.error('debug', `Failed to load highlights: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoadingHighlights(false)
    }
  }

  const handleClearHighlights = () => {
    setHighlightEvents([])
    setTLoadHighlights(null)
    setTFirstHighlight(null)
    DebugBus.info('debug', 'Cleared highlight data')
  }

  const handleLoadMyHighlights = async () => {
    if (!relayPool || !activeAccount?.pubkey) {
      DebugBus.warn('debug', 'Please log in to load your highlights')
      return
    }
    const start = performance.now()
    setHighlightEvents([])
    setIsLoadingHighlights(true)
    setTLoadHighlights(null)
    setTFirstHighlight(null)
    DebugBus.info('debug', 'Loading my highlights...')
    try {
      let firstEventTime: number | null = null
      await fetchHighlights(relayPool, activeAccount.pubkey, (h) => {
        if (firstEventTime === null) {
          firstEventTime = performance.now() - start
          setTFirstHighlight(Math.round(firstEventTime))
        }
        setHighlightEvents(prev => {
          if (prev.some(x => x.id === h.id)) return prev
          const next = [...prev, { ...h, pubkey: h.pubkey, created_at: h.created_at, id: h.id, kind: 9802, tags: [], content: h.content, sig: '' } as NostrEvent]
          return next.sort((a, b) => b.created_at - a.created_at)
        })
      }, settings, false, eventStore || undefined)
    } finally {
      setIsLoadingHighlights(false)
      const elapsed = Math.round(performance.now() - start)
      setTLoadHighlights(elapsed)
      DebugBus.info('debug', `Loaded my highlights in ${elapsed}ms`)
    }
  }

  const handleLoadFriendsHighlights = async () => {
    if (!relayPool || !activeAccount?.pubkey) {
      DebugBus.warn('debug', 'Please log in to load friends highlights')
      return
    }
    
    // Get contacts from centralized controller (should already be loaded by App.tsx)
    const contacts = contactsController.getContacts()
    if (contacts.size === 0) {
      DebugBus.warn('debug', 'No friends found. Make sure you have contacts loaded.')
      return
    }
    
    const start = performance.now()
    setHighlightEvents([])
    setIsLoadingHighlights(true)
    setTLoadHighlights(null)
    setTFirstHighlight(null)
    DebugBus.info('debug', `Loading highlights from ${contacts.size} friends (using cached contacts)...`)
    
    let firstEventTime: number | null = null
    
    try {
      await fetchHighlightsFromAuthors(relayPool, Array.from(contacts), (h) => {
        if (firstEventTime === null) {
          firstEventTime = performance.now() - start
          setTFirstHighlight(Math.round(firstEventTime))
        }
        setHighlightEvents(prev => {
          if (prev.some(x => x.id === h.id)) return prev
          const next = [...prev, { ...h, pubkey: h.pubkey, created_at: h.created_at, id: h.id, kind: 9802, tags: [], content: h.content, sig: '' } as NostrEvent]
          return next.sort((a, b) => b.created_at - a.created_at)
        })
      }, eventStore || undefined)
    } finally {
      setIsLoadingHighlights(false)
      const elapsed = Math.round(performance.now() - start)
      setTLoadHighlights(elapsed)
      DebugBus.info('debug', `Loaded friends highlights in ${elapsed}ms`)
    }
  }

  const handleLoadNostrverseHighlights = async () => {
    if (!relayPool) {
      DebugBus.warn('debug', 'Relay pool not available')
      return
    }
    const start = performance.now()
    setHighlightEvents([])
    setIsLoadingHighlights(true)
    setTLoadHighlights(null)
    setTFirstHighlight(null)
    DebugBus.info('debug', 'Loading nostrverse highlights (kind:9802)...')
    try {
      let firstEventTime: number | null = null
      const seenIds = new Set<string>()
      const { queryEvents } = await import('../services/dataFetch')
      
      const events = await queryEvents(relayPool, { kinds: [9802], limit: 500 }, {
        onEvent: (evt) => {
          if (seenIds.has(evt.id)) return
          seenIds.add(evt.id)
          if (firstEventTime === null) {
            firstEventTime = performance.now() - start
            setTFirstHighlight(Math.round(firstEventTime))
          }
          setHighlightEvents(prev => [...prev, evt])
        }
      })
      
      DebugBus.info('debug', `Loaded ${events.length} nostrverse highlights`)
    } finally {
      setIsLoadingHighlights(false)
      const elapsed = Math.round(performance.now() - start)
      setTLoadHighlights(elapsed)
      DebugBus.info('debug', `Loaded nostrverse highlights in ${elapsed}ms`)
    }
  }

  const handleLoadMyWritings = async () => {
    if (!relayPool || !activeAccount?.pubkey || !eventStore) {
      DebugBus.warn('debug', 'Please log in to load your writings')
      return
    }
    const start = performance.now()
    setWritingPosts([])
    setIsLoadingWritings(true)
    setTLoadWritings(null)
    setTFirstWriting(null)
    DebugBus.info('debug', 'Loading my writings via writingsController...')
    try {
      let firstEventTime: number | null = null
      const unsub = writingsController.onWritings((posts) => {
        if (firstEventTime === null && posts.length > 0) {
          firstEventTime = performance.now() - start
          setTFirstWriting(Math.round(firstEventTime))
        }
        setWritingPosts(posts)
      })
      
      await writingsController.start({
        relayPool,
        eventStore,
        pubkey: activeAccount.pubkey,
        force: true
      })
      
      unsub()
      const currentWritings = writingsController.getWritings()
      setWritingPosts(currentWritings)
      DebugBus.info('debug', `Loaded ${currentWritings.length} writings via controller`)
    } finally {
      setIsLoadingWritings(false)
      const elapsed = Math.round(performance.now() - start)
      setTLoadWritings(elapsed)
      DebugBus.info('debug', `Loaded my writings in ${elapsed}ms`)
    }
  }

  const handleLoadFriendsWritings = async () => {
    if (!relayPool || !activeAccount?.pubkey) {
      DebugBus.warn('debug', 'Please log in to load friends writings')
      return
    }
    const start = performance.now()
    setWritingPosts([])
    setIsLoadingWritings(true)
    setTLoadWritings(null)
    setTFirstWriting(null)
    DebugBus.info('debug', 'Loading friends writings...')
    try {
      // Get contacts first
      await contactsController.start({ relayPool, pubkey: activeAccount.pubkey })
      const friends = contactsController.getContacts()
      const friendsArray = Array.from(friends)
      DebugBus.info('debug', `Found ${friendsArray.length} friends`)
      
      if (friendsArray.length === 0) {
        DebugBus.warn('debug', 'No friends found to load writings from')
        return
      }
      
      let firstEventTime: number | null = null
      const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
      const posts = await fetchBlogPostsFromAuthors(
        relayPool,
        friendsArray,
        relayUrls,
        (post) => {
          if (firstEventTime === null) {
            firstEventTime = performance.now() - start
            setTFirstWriting(Math.round(firstEventTime))
          }
          setWritingPosts(prev => {
            const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
            const key = `${post.author}:${dTag}`
            const exists = prev.find(p => {
              const pDTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
              return `${p.author}:${pDTag}` === key
            })
            if (exists) return prev
            return [...prev, post].sort((a, b) => {
              const timeA = a.published || a.event.created_at
              const timeB = b.published || b.event.created_at
              return timeB - timeA
            })
          })
        }
      )
      
      setWritingPosts(posts)
      DebugBus.info('debug', `Loaded ${posts.length} friend writings`)
    } finally {
      setIsLoadingWritings(false)
      const elapsed = Math.round(performance.now() - start)
      setTLoadWritings(elapsed)
      DebugBus.info('debug', `Loaded friend writings in ${elapsed}ms`)
    }
  }

  const handleLoadNostrverseWritings = async () => {
    if (!relayPool) {
      DebugBus.warn('debug', 'Relay pool not available')
      return
    }
    const start = performance.now()
    setWritingPosts([])
    setIsLoadingWritings(true)
    setTLoadWritings(null)
    setTFirstWriting(null)
    DebugBus.info('debug', 'Loading nostrverse writings (kind:30023)...')
    try {
      let firstEventTime: number | null = null
      const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
      
      const { queryEvents } = await import('../services/dataFetch')
      const { Helpers } = await import('applesauce-core')
      const { getArticleTitle, getArticleSummary, getArticleImage, getArticlePublished } = Helpers
      
      const uniqueEvents = new Map<string, NostrEvent>()
      await queryEvents(relayPool, { kinds: [30023], limit: 50 }, {
        relayUrls,
        onEvent: (evt) => {
          const dTag = evt.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${evt.pubkey}:${dTag}`
          const existing = uniqueEvents.get(key)
          if (!existing || evt.created_at > existing.created_at) {
            uniqueEvents.set(key, evt)
            
            if (firstEventTime === null) {
              firstEventTime = performance.now() - start
              setTFirstWriting(Math.round(firstEventTime))
            }
            
            const posts = Array.from(uniqueEvents.values()).map(event => ({
              event,
              title: getArticleTitle(event) || 'Untitled',
              summary: getArticleSummary(event),
              image: getArticleImage(event),
              published: getArticlePublished(event),
              author: event.pubkey
            } as BlogPostPreview)).sort((a, b) => {
              const timeA = a.published || a.event.created_at
              const timeB = b.published || b.event.created_at
              return timeB - timeA
            })
            
            setWritingPosts(posts)
          }
        }
      })
      
      const finalPosts = Array.from(uniqueEvents.values()).map(event => ({
        event,
        title: getArticleTitle(event) || 'Untitled',
        summary: getArticleSummary(event),
        image: getArticleImage(event),
        published: getArticlePublished(event),
        author: event.pubkey
      } as BlogPostPreview)).sort((a, b) => {
        const timeA = a.published || a.event.created_at
        const timeB = b.published || b.event.created_at
        return timeB - timeA
      })
      
      setWritingPosts(finalPosts)
      DebugBus.info('debug', `Loaded ${finalPosts.length} nostrverse writings`)
    } finally {
      setIsLoadingWritings(false)
      const elapsed = Math.round(performance.now() - start)
      setTLoadWritings(elapsed)
      DebugBus.info('debug', `Loaded nostrverse writings in ${elapsed}ms`)
    }
  }

  const handleClearWritings = () => {
    setWritingPosts([])
    setTLoadWritings(null)
    setTFirstWriting(null)
  }

  const handleLoadFriendsList = async () => {
    if (!relayPool || !activeAccount?.pubkey) {
      DebugBus.warn('debug', 'Please log in to load friends list')
      return
    }
    
    setFriendsButtonLoading(true)
    DebugBus.info('debug', 'Loading friends list via controller...')
    
    // Clear current list
    setFriendsPubkeys(new Set())
    
    // Subscribe to controller updates to see streaming
    const unsubscribe = contactsController.onContacts((contacts) => {
      setFriendsPubkeys(new Set(contacts))
    })
    
    try {
      // Force reload to see streaming behavior
      await contactsController.start({ relayPool, pubkey: activeAccount.pubkey, force: true })
      const final = contactsController.getContacts()
      setFriendsPubkeys(new Set(final))
      DebugBus.info('debug', `Loaded ${final.size} friends from controller`)
    } catch (err) {
      console.error('[debug] Failed to load friends:', err)
      DebugBus.error('debug', `Failed to load friends: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      unsubscribe()
      setFriendsButtonLoading(false)
    }
  }

  const friendsNpubs = useMemo(() => {
    return Array.from(friendsPubkeys).map(pk => nip19.npubEncode(pk))
  }, [friendsPubkeys])

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setBunkerError('Please enter a bunker URI')
      return
    }

    if (!bunkerUri.startsWith('bunker://')) {
      setBunkerError('Invalid bunker URI. Must start with bunker://')
      return
    }

    try {
      setIsBunkerLoading(true)
      setBunkerError(null)
      
      // Create signer from bunker URI with default permissions
      const permissions = getDefaultBunkerPermissions()
      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, { permissions })
      
      // Get pubkey from signer
      const pubkey = await signer.getPublicKey()
      
      // Create account from signer
      const account = new Accounts.NostrConnectAccount(pubkey, signer)
      
      // Add to account manager and set active
      accountManager.addAccount(account)
      accountManager.setActive(account)
      
      // Clear input on success
      setBunkerUri('')
    } catch (err) {
      console.error('[bunker] Login failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to bunker'
      
      // Check for permission-related errors
      if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('unauthorized')) {
        setBunkerError('Your bunker connection is missing signing permissions. Reconnect and approve signing.')
      } else {
        setBunkerError(errorMessage)
      }
    } finally {
      setIsBunkerLoading(false)
    }
  }

  const CodeBox = ({ value }: { value: string }) => (
    <div className="h-20 overflow-y-auto font-mono text-xs leading-relaxed p-2 bg-gray-100 dark:bg-gray-800 rounded whitespace-pre-wrap break-all">
      {value || '—'}
    </div>
  )

  const getLiveTiming = (mode: 'nip44' | 'nip04', type: 'encrypt' | 'decrypt') => {
    const timing = liveTiming[mode]
    if (timing && timing.type === type) {
      const elapsed = Math.round(performance.now() - timing.startTime)
      return elapsed
    }
    return null
  }

  const getBookmarkLiveTiming = (operation: 'loadBookmarks' | 'decryptBookmarks' | 'loadHighlights') => {
    const timing = liveTiming[operation]
    if (timing) {
      const elapsed = Math.round(performance.now() - timing.startTime)
      return elapsed
    }
    return null
  }

  const Stat = ({ label, value, mode, type, bookmarkOp }: { 
    label: string; 
    value?: string | number | null;
    mode?: 'nip44' | 'nip04';
    type?: 'encrypt' | 'decrypt';
    bookmarkOp?: 'loadBookmarks' | 'decryptBookmarks' | 'loadHighlights';
  }) => {
    const liveValue = bookmarkOp ? getBookmarkLiveTiming(bookmarkOp) : (mode && type ? getLiveTiming(mode, type) : null)
    const isLive = !!liveValue
    
    let displayValue: string
    if (isLive) {
      displayValue = ''
    } else if (value !== null && value !== undefined) {
      displayValue = `${value}ms`
    } else {
      displayValue = '—'
    }
    
    return (
      <span className="badge" style={{ marginRight: 8 }}>
        <FontAwesomeIcon icon={faClock} style={{ marginRight: 4, fontSize: '0.8em' }} />
        {label}: {isLive ? (
          <FontAwesomeIcon icon={faSpinner} className="animate-spin" style={{ fontSize: '0.8em' }} />
        ) : (
          displayValue
        )}
      </span>
    )
  }

  const debugContent = (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Debug</h2>
        <div className="settings-header-actions">
          <span className="opacity-70">Active pubkey:</span> <code className="text-sm">{pubkey || 'none'}</code>
        </div>
      </div>

      <div className="settings-content">

        {/* Account Connection Section */}
        <div className="settings-section">
          <h3 className="section-title">
            {activeAccount 
              ? activeAccount.type === 'extension' 
                ? 'Browser Extension' 
                : activeAccount.type === 'nostr-connect'
                ? 'Bunker Connection'
                : 'Account Connection'
              : 'Account Connection'}
          </h3>
          {!activeAccount ? (
            <div>
              <div className="text-sm opacity-70 mb-3">Connect to your bunker (Nostr Connect signer) to enable encryption/decryption testing</div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="bunker://..."
                  value={bunkerUri}
                  onChange={(e) => setBunkerUri(e.target.value)}
                  disabled={isBunkerLoading}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleBunkerLogin}
                  disabled={isBunkerLoading || !bunkerUri.trim()}
                >
                  {isBunkerLoading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              {bunkerError && (
                <div className="text-sm text-red-600 dark:text-red-400 mb-2">{bunkerError}</div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-70">
                  {activeAccount.type === 'extension' 
                    ? 'Connected via browser extension' 
                    : activeAccount.type === 'nostr-connect'
                    ? 'Connected to bunker'
                    : 'Connected'}
                </div>
                <div className="text-sm font-mono">{pubkey}</div>
              </div>
                  <button
                    className="btn"
                    style={{ 
                      background: 'rgb(220 38 38)', 
                      color: 'white', 
                      border: '1px solid rgb(220 38 38)',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(185 28 28)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgb(220 38 38)'}
                    onClick={() => accountManager.removeAccount(activeAccount)}
                  >
                    Disconnect
                  </button>
            </div>
          )}
        </div>

        {/* Encryption Tools Section */}
        <div className="settings-section">
          <h3 className="section-title">Encryption Tools</h3>
          <div className="setting-group">
            <label className="setting-label">Payload</label>
                <textarea 
                  className="textarea w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700" 
                  value={payload} 
                  onChange={e => setPayload(e.target.value)} 
                  rows={3} 
                />
            <div className="flex gap-2 mt-3 justify-end">
              <button className="btn btn-secondary" onClick={() => setPayload(defaultPayload)}>Reset</button>
              <button className="btn btn-secondary" onClick={() => { setCipher44(''); setCipher04(''); setPlain44(''); setPlain04(''); setTEncrypt44(null); setTEncrypt04(null); setTDecrypt44(null); setTDecrypt04(null) }}>Clear</button>
            </div>
          </div>
          
          <div className="grid" style={{ gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <div className="setting-group">
              <label className="setting-label">NIP-44</label>
              <div className="flex gap-2 mb-3">
                <button className="btn btn-primary" onClick={() => doEncrypt('nip44')} disabled={!hasNip44}>Encrypt</button>
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip44')} disabled={!cipher44}>Decrypt</button>
              </div>
              <label className="block text-sm opacity-70 mb-2">Encrypted:</label>
              <CodeBox value={cipher44} />
              <div className="mt-3">
                <span className="text-sm opacity-70">Plain:</span>
                <CodeBox value={plain44} />
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">NIP-04</label>
              <div className="flex gap-2 mb-3">
                <button className="btn btn-primary" onClick={() => doEncrypt('nip04')} disabled={!hasNip04}>Encrypt</button>
                <button className="btn btn-secondary" onClick={() => doDecrypt('nip04')} disabled={!cipher04}>Decrypt</button>
              </div>
              <label className="block text-sm opacity-70 mb-2">Encrypted:</label>
              <CodeBox value={cipher04} />
              <div className="mt-3">
                <span className="text-sm opacity-70">Plain:</span>
                <CodeBox value={plain04} />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Timing Section */}
        <div className="settings-section">
          <h3 className="section-title">Performance Timing</h3>
          <div className="text-sm opacity-70 mb-3">Encryption and decryption operation durations</div>
          <div className="grid" style={{ gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <div className="setting-group">
              <label className="setting-label">NIP-44</label>
              <div className="flex flex-wrap items-center gap-2">
                <Stat label="enc" value={tEncrypt44} mode="nip44" type="encrypt" />
                <Stat label="dec" value={tDecrypt44} mode="nip44" type="decrypt" />
              </div>
            </div>
            <div className="setting-group">
              <label className="setting-label">NIP-04</label>
              <div className="flex flex-wrap items-center gap-2">
                <Stat label="enc" value={tEncrypt04} mode="nip04" type="encrypt" />
                <Stat label="dec" value={tDecrypt04} mode="nip04" type="decrypt" />
              </div>
            </div>
          </div>
        </div>

        {/* Bookmark Loading Section */}
        <div className="settings-section">
          <h3 className="section-title">Bookmark Loading</h3>
          <div className="text-sm opacity-70 mb-3">Test bookmark loading with auto-decryption (kinds: 10003, 30003, 30001, 39701)</div>
          
          <div className="flex gap-2 mb-3 items-center">
            <button 
              className="btn btn-primary" 
              onClick={handleLoadBookmarks}
              disabled={isLoadingBookmarks || !relayPool || !activeAccount}
            >
              {isLoadingBookmarks ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Load Bookmarks'
              )}
            </button>
            <button 
              className="btn btn-secondary ml-auto" 
              onClick={handleClearBookmarks}
              disabled={bookmarkEvents.length === 0 && !bookmarkStats}
            >
              Clear
            </button>
          </div>

          <div className="mb-3 flex gap-2 flex-wrap">
            <Stat label="total" value={tLoadBookmarks} bookmarkOp="loadBookmarks" />
            <Stat label="first event" value={tFirstBookmark} />
            <Stat label="decrypt" value={tDecryptBookmarks} bookmarkOp="decryptBookmarks" />
          </div>

          {bookmarkStats && (
            <div className="mb-3">
              <div className="text-sm opacity-70 mb-2">Decrypted Bookmarks:</div>
              <div className="font-mono text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded">
                <div>Public: {bookmarkStats.public}</div>
                <div>Private: {bookmarkStats.private}</div>
                <div className="font-semibold mt-1">Total: {bookmarkStats.public + bookmarkStats.private}</div>
              </div>
            </div>
          )}

          {bookmarkEvents.length > 0 && (
            <div className="mb-3">
              <div className="text-sm opacity-70 mb-2">Loaded Events ({bookmarkEvents.length}):</div>
              <div className="space-y-2">
                {bookmarkEvents.map((evt, idx) => {
                  const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1]
                  const titleTag = evt.tags?.find((t: string[]) => t[0] === 'title')?.[1]
                  const size = getEventSize(evt)
                  const counts = getBookmarkCount(evt)
                  const hasEncrypted = hasEncryptedContent(evt)
                  const decryptResult = decryptedEvents.get(evt.id)
                  
                  return (
                    <div key={idx} className="font-mono text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="font-semibold mb-1">{getKindName(evt.kind)}</div>
                      {dTag && <div className="opacity-70">d-tag: {dTag}</div>}
                      {titleTag && <div className="opacity-70">title: {titleTag}</div>}
                      <div className="mt-1">
                        <div>Size: {formatBytes(size)}</div>
                        <div>Public: {counts.public}</div>
                        {hasEncrypted && <div>🔒 Has encrypted content</div>}
                      </div>
                      {decryptResult && (
                        <div className="mt-1 text-[11px] opacity-80">
                          <div>✓ Decrypted: {decryptResult.public} public, {decryptResult.private} private</div>
                        </div>
                      )}
                      <div className="opacity-50 mt-1 text-[10px] break-all">ID: {evt.id}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Highlight Loading Section */}
        <div className="settings-section">
          <h3 className="section-title">Highlight Loading</h3>
          <div className="text-sm opacity-70 mb-3">Test highlight loading with EOSE-based queryEvents (kind: 9802). Author mode defaults to your highlights.</div>
          
          <div className="mb-3">
            <div className="text-sm opacity-70 mb-2">Query Mode:</div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={highlightMode === 'article'}
                  onChange={() => setHighlightMode('article')}
                />
                <span>Article (#a)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={highlightMode === 'url'}
                  onChange={() => setHighlightMode('url')}
                />
                <span>URL (#r)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={highlightMode === 'author'}
                  onChange={() => setHighlightMode('author')}
                />
                <span>Author</span>
              </label>
            </div>
          </div>

          <div className="mb-3">
            {highlightMode === 'article' && (
              <input
                type="text"
                className="input w-full"
                placeholder="30023:pubkey:identifier"
                value={highlightArticleCoord}
                onChange={(e) => setHighlightArticleCoord(e.target.value)}
                disabled={isLoadingHighlights}
              />
            )}
            {highlightMode === 'url' && (
              <input
                type="text"
                className="input w-full"
                placeholder="https://example.com/article"
                value={highlightUrl}
                onChange={(e) => setHighlightUrl(e.target.value)}
                disabled={isLoadingHighlights}
              />
            )}
            {highlightMode === 'author' && (
              <input
                type="text"
                className="input w-full"
                placeholder={pubkey ? `${pubkey.slice(0, 16)}... (logged-in user)` : 'pubkey (hex)'}
                value={highlightAuthor}
                onChange={(e) => setHighlightAuthor(e.target.value)}
                disabled={isLoadingHighlights}
              />
            )}
          </div>

          <div className="flex gap-2 mb-3 items-center">
            <button 
              className="btn btn-primary" 
              onClick={handleLoadHighlights}
              disabled={isLoadingHighlights || !relayPool}
            >
              {isLoadingHighlights ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Load Highlights'
              )}
            </button>
            <button 
              className="btn btn-secondary ml-auto" 
              onClick={handleClearHighlights}
              disabled={highlightEvents.length === 0}
            >
              Clear
            </button>
          </div>

          <div className="mb-3 text-sm opacity-70">Quick load options:</div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button 
              className="btn btn-secondary text-sm" 
              onClick={handleLoadMyHighlights}
              disabled={isLoadingHighlights || !relayPool || !activeAccount}
            >
              Load My Highlights
            </button>
            <button 
              className="btn btn-secondary text-sm" 
              onClick={handleLoadFriendsHighlights}
              disabled={isLoadingHighlights || !relayPool || !activeAccount}
            >
              Load Friends Highlights
            </button>
            <button 
              className="btn btn-secondary text-sm" 
              onClick={handleLoadNostrverseHighlights}
              disabled={isLoadingHighlights || !relayPool}
            >
              Load Nostrverse Highlights
            </button>
          </div>

          <div className="mb-3 flex gap-2 flex-wrap">
            <Stat label="total" value={tLoadHighlights} bookmarkOp="loadHighlights" />
            <Stat label="first event" value={tFirstHighlight} />
          </div>

          {highlightEvents.length > 0 && (
            <div className="mb-3">
              <div className="text-sm opacity-70 mb-2">Loaded Highlights ({highlightEvents.length}):</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {highlightEvents.map((evt, idx) => {
                  const content = evt.content || ''
                  const shortContent = content.length > 100 ? content.substring(0, 100) + '...' : content
                  const aTag = evt.tags?.find((t: string[]) => t[0] === 'a')?.[1]
                  const rTag = evt.tags?.find((t: string[]) => t[0] === 'r')?.[1]
                  const eTag = evt.tags?.find((t: string[]) => t[0] === 'e')?.[1]
                  const contextTag = evt.tags?.find((t: string[]) => t[0] === 'context')?.[1]
                  
                  return (
                    <div key={idx} className="font-mono text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="font-semibold mb-1">Highlight #{idx + 1}</div>
                      <div className="opacity-70 mb-1">
                        <div>Author: {evt.pubkey.slice(0, 16)}...</div>
                        <div>Created: {new Date(evt.created_at * 1000).toLocaleString()}</div>
                      </div>
                      <div className="mt-1">
                        <div className="font-semibold text-[11px]">Content:</div>
                        <div className="italic">&quot;{shortContent}&quot;</div>
                      </div>
                      {contextTag && (
                        <div className="mt-1 text-[11px] opacity-70">
                          <div>Context: {contextTag.substring(0, 60)}...</div>
                        </div>
                      )}
                      {aTag && <div className="mt-1 text-[11px] opacity-70">#a: {aTag}</div>}
                      {rTag && <div className="mt-1 text-[11px] opacity-70">#r: {rTag}</div>}
                      {eTag && <div className="mt-1 text-[11px] opacity-70">#e: {eTag.slice(0, 16)}...</div>}
                      <div className="opacity-50 mt-1 text-[10px] break-all">ID: {evt.id}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Writings Loading Section */}
        <div className="settings-section">
          <h3 className="section-title">Writings Loading</h3>
          
          <div className="mb-3 text-sm opacity-70">Quick load options:</div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button 
              className="btn btn-secondary text-sm" 
              onClick={handleLoadMyWritings}
              disabled={isLoadingWritings || !relayPool || !activeAccount || !eventStore}
            >
              {isLoadingWritings ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : (
                'Load My Writings'
              )}
            </button>
            <button 
              className="btn btn-secondary text-sm" 
              onClick={handleLoadFriendsWritings}
              disabled={isLoadingWritings || !relayPool || !activeAccount}
            >
              {isLoadingWritings ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : (
                'Load Friends Writings'
              )}
            </button>
            <button 
              className="btn btn-secondary text-sm" 
              onClick={handleLoadNostrverseWritings}
              disabled={isLoadingWritings || !relayPool}
            >
              {isLoadingWritings ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : (
                'Load Nostrverse Writings'
              )}
            </button>
            <button 
              className="btn btn-secondary text-sm ml-auto" 
              onClick={handleClearWritings}
              disabled={writingPosts.length === 0}
            >
              Clear
            </button>
          </div>

          <div className="mb-3 flex gap-2 flex-wrap">
            <Stat label="total" value={tLoadWritings} />
            <Stat label="first event" value={tFirstWriting} />
          </div>

          {writingPosts.length > 0 && (
            <div className="mb-3">
              <div className="text-sm opacity-70 mb-2">Loaded Writings ({writingPosts.length}):</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {writingPosts.map((post, idx) => {
                  const title = post.title
                  const summary = post.summary
                  const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
                  
                  return (
                    <div key={idx} className="font-mono text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="font-semibold mb-1">Writing #{idx + 1}</div>
                      <div className="opacity-70 mb-1">
                        <div>Author: {post.author.slice(0, 16)}...</div>
                        <div>Published: {post.published ? new Date(post.published * 1000).toLocaleString() : new Date(post.event.created_at * 1000).toLocaleString()}</div>
                        <div>d-tag: {dTag || '(empty)'}</div>
                      </div>
                      <div className="mt-1">
                        <div className="font-semibold text-[11px]">Title:</div>
                        <div>&quot;{title}&quot;</div>
                      </div>
                      {summary && (
                        <div className="mt-1 text-[11px] opacity-70">
                          <div>Summary: {summary.substring(0, 100)}{summary.length > 100 ? '...' : ''}</div>
                        </div>
                      )}
                      {post.image && (
                        <div className="mt-1 text-[11px] opacity-70">
                          <div>Image: {post.image.substring(0, 40)}...</div>
                        </div>
                      )}
                      <div className="opacity-50 mt-1 text-[10px] break-all">ID: {post.event.id}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Web of Trust Section */}
        <div className="settings-section">
          <h3 className="section-title">Web of Trust</h3>
          <div className="text-sm opacity-70 mb-3">Load your followed contacts (friends) for highlight fetching:</div>
          
          <div className="mb-3">
            <button 
              className="btn btn-primary" 
              onClick={handleLoadFriendsList}
              disabled={friendsButtonLoading || !relayPool || !activeAccount}
            >
              {friendsButtonLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Load Friends'
              )}
            </button>
          </div>

          {friendsPubkeys.size > 0 && (
            <div className="mb-3">
              <div className="text-sm opacity-70 mb-2">Friends Count: {friendsNpubs.length}</div>
              <div className="font-mono text-xs max-h-48 overflow-y-auto bg-gray-100 dark:bg-gray-800 p-3 rounded space-y-1">
                {friendsNpubs.map(npub => (
                  <div key={npub} title={npub} className="truncate hover:text-clip hover:whitespace-normal cursor-pointer">
                    {npub}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Debug Logs Section */}
        <div className="settings-section">
          <h3 className="section-title">Debug Logs</h3>
          <div className="text-sm opacity-70 mb-3">Recent bunker logs:</div>
            <div className="max-h-192 overflow-y-auto font-mono text-xs leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-sm opacity-50 italic">No logs yet</div>
            ) : (
              logs.slice(-200).map((l, i) => (
                <div key={i} className="mb-1 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="opacity-70">[{new Date(l.ts).toLocaleTimeString()}]</span> <span className="font-semibold">{l.level.toUpperCase()}</span> {l.source}: {l.message}
                  {l.data !== undefined && (
                    <span className="opacity-70"> — {typeof l.data === 'string' ? l.data : JSON.stringify(l.data)}</span>
                  )}
                </div>
              ))
            )}
          </div>
            <div className="mt-3">
              <div className="flex justify-end mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={debugEnabled}
                    onChange={toggleDebug}
                    className="checkbox"
                  />
                  <span className="text-sm">Show all applesauce debug logs</span>
                </label>
              </div>
              <div className="flex justify-end">
                <button className="btn btn-secondary" onClick={() => setLogs([])}>Clear logs</button>
              </div>
            </div>
        </div>
      </div>
    </div>
  )
  
  return (
    <ThreePaneLayout
      isCollapsed={isCollapsed}
      isHighlightsCollapsed={true}
      isSidebarOpen={false}
      showSettings={false}
      showSupport={true}
      bookmarks={bookmarks}
      bookmarksLoading={bookmarksLoading}
      viewMode={viewMode}
      isRefreshing={false}
      lastFetchTime={null}
      onToggleSidebar={isMobile ? () => {} : () => setIsCollapsed(!isCollapsed)}
      onLogout={onLogout}
      onViewModeChange={setViewMode}
      onOpenSettings={() => navigate('/settings')}
      onRefresh={onRefreshBookmarks}
      relayPool={relayPool}
      eventStore={eventStore}
      readerLoading={false}
      readerContent={undefined}
      selectedUrl={undefined}
      settings={settings}
      onSaveSettings={saveSettings}
      onCloseSettings={() => navigate('/')}
      classifiedHighlights={[]}
      showHighlights={false}
      selectedHighlightId={undefined}
      highlightVisibility={{ nostrverse: true, friends: true, mine: true }}
      onHighlightClick={() => {}}
      onTextSelection={() => {}}
      onClearSelection={() => {}}
      currentUserPubkey={activeAccount?.pubkey}
      followedPubkeys={new Set()}
      activeAccount={activeAccount}
      currentArticle={null}
      highlights={[]}
      highlightsLoading={false}
      onToggleHighlightsPanel={() => {}}
      onSelectUrl={() => {}}
      onToggleHighlights={() => {}}
      onRefreshHighlights={() => {}}
      onHighlightVisibilityChange={() => {}}
      highlightButtonRef={{ current: null }}
      onCreateHighlight={() => {}}
      hasActiveAccount={!!activeAccount}
      toastMessage={undefined}
      toastType={undefined}
      onClearToast={() => {}}
      support={debugContent}
    />
  )
}

export default Debug
