import React, { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { completeOnEose } from 'applesauce-relay'
import { getParsedContent } from 'applesauce-content/text'
import { NostrEvent, Filter } from 'nostr-tools'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'

interface ParsedNode {
  type: string
  value?: string
  url?: string
  encoded?: string
  children?: ParsedNode[]
}

interface ParsedContent {
  type: string
  children: ParsedNode[]
}

interface Bookmark {
  id: string
  title: string
  url: string
  content: string
  created_at: number
  tags: string[][]
  bookmarkCount?: number
  eventReferences?: string[]
  articleReferences?: string[]
  urlReferences?: string[]
  parsedContent?: ParsedContent
  individualBookmarks?: IndividualBookmark[]
}

interface IndividualBookmark {
  id: string
  content: string
  created_at: number
  pubkey: string
  kind: number
  tags: string[][]
  parsedContent?: ParsedContent
  author?: string
  type: 'event' | 'article'
}

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ relayPool, onLogout }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const activeAccount = Hooks.useActiveAccount()
  
  // Use ProfileModel to get user profile information
  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

  useEffect(() => {
    console.log('Bookmarks useEffect triggered')
    console.log('relayPool:', !!relayPool)
    console.log('activeAccount:', !!activeAccount)
    if (relayPool && activeAccount) {
      console.log('Starting to fetch bookmarks...')
      fetchBookmarks()
    } else {
      console.log('Not fetching bookmarks - missing dependencies')
    }
  }, [relayPool, activeAccount?.pubkey]) // Only depend on pubkey, not the entire activeAccount object

  const fetchBookmarks = async () => {
    if (!relayPool || !activeAccount || loading) return // Prevent multiple simultaneous fetches

    try {
      setLoading(true)
      console.log('Fetching bookmarks for pubkey:', activeAccount.pubkey)
      console.log('Starting bookmark fetch for:', activeAccount.pubkey.slice(0, 8) + '...')
      
      // Use applesauce relay pool to fetch bookmark events (kind 10003)
      // This follows the proper applesauce pattern from the documentation
      
      // Create a filter for bookmark events (kind 10003) for the specific pubkey
      const filter: Filter = {
        kinds: [10003],
        authors: [activeAccount.pubkey]
      }
      
      // Also try a broader filter to see if we can get any events
      const testFilter: Filter = {
        authors: [activeAccount.pubkey],
        limit: 5
      }
      
      console.log('Testing with broader filter first...')
      const testEvents = await lastValueFrom(
        relayPool.req(relayUrls, testFilter).pipe(
          completeOnEose(),
          takeUntil(timer(5000)),
          toArray(),
        )
      )
      console.log('Test events found:', testEvents.length, 'kinds:', testEvents.map(e => e.kind))
      
      // Get relay URLs from the pool
      console.log('Querying relay pool with filter:', filter)
      console.log('Using relays:', relayUrls)
      
      // Use the proper applesauce pattern with req() method
      const events = await lastValueFrom(
        relayPool.req(relayUrls, filter).pipe(
          // Complete when EOSE is received
          completeOnEose(),
          // Timeout after 10 seconds
          takeUntil(timer(10000)),
          // Collect all events into an array
          toArray(),
        )
      )
      
      console.log('Received events:', events.length)
      
      // Deduplicate events by ID to prevent duplicates from multiple relays
      const uniqueEvents = events.reduce((acc, event) => {
        if (!acc.find(e => e.id === event.id)) {
          acc.push(event)
        }
        return acc
      }, [] as NostrEvent[])
      
      console.log('Unique events after deduplication:', uniqueEvents.length)
      
      // If no events found, set empty bookmarks and stop loading
      if (uniqueEvents.length === 0) {
        console.log('No bookmark events found')
        setBookmarks([])
        setLoading(false)
        return
      }
      
      // Parse the events into bookmarks
      const bookmarkList: Bookmark[] = []
      for (const event of uniqueEvents) {
        console.log('Processing bookmark event:', event)
        const bookmarkData = await parseBookmarkEvent(event)
        if (bookmarkData) {
          bookmarkList.push(bookmarkData)
          console.log('Parsed bookmark:', bookmarkData)
        }
      }
      
      console.log('Bookmark fetch complete. Found:', bookmarkList.length, 'bookmarks')
      setBookmarks(bookmarkList)
      setLoading(false)

    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
      setLoading(false)
    }
  }

  const fetchIndividualBookmarks = async (eventIds: string[], articleIds: string[]): Promise<IndividualBookmark[]> => {
    if (!relayPool || (eventIds.length === 0 && articleIds.length === 0)) {
      console.log('No individual bookmarks to fetch')
      return []
    }

    try {
      const allIds = [...eventIds, ...articleIds]
      console.log('Fetching individual bookmarks for IDs:', allIds.length)
      
      // Create filters for both event IDs and article IDs
      const eventFilters: Filter[] = []
      
      if (eventIds.length > 0) {
        eventFilters.push({
          ids: eventIds
        })
      }
      
      if (articleIds.length > 0) {
        // For article IDs, we need to parse the kind and pubkey from the 'a' tag
        const articleFilters = articleIds.map(articleId => {
          const [kind, pubkey, identifier] = articleId.split(':')
          return {
            kinds: [parseInt(kind)],
            authors: [pubkey],
            '#d': [identifier]
          }
        })
        eventFilters.push(...articleFilters)
      }
      
      const allEvents: NostrEvent[] = []
      
      // Fetch events for each filter
      for (const filter of eventFilters) {
        console.log('Fetching with filter:', filter)
        const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
        const events = await lastValueFrom(
          relayPool.req(relayUrls, filter).pipe(
            completeOnEose(),
            takeUntil(timer(5000)), // Reduced timeout to 5 seconds
            toArray(),
          )
        )
        console.log('Fetched events for filter:', events.length)
        allEvents.push(...events)
      }
      
      // Deduplicate events
      const uniqueEvents = allEvents.reduce((acc, event) => {
        if (!acc.find(e => e.id === event.id)) {
          acc.push(event)
        }
        return acc
      }, [] as NostrEvent[])
      
      console.log('Fetched individual bookmarks:', uniqueEvents.length)
      
      // Convert to IndividualBookmark format
      return uniqueEvents.map(event => {
        const parsedContent = event.content ? getParsedContent(event.content) as ParsedContent : undefined
        const isArticle = articleIds.includes(event.id) || event.tags.some(tag => tag[0] === 'a')
        
        return {
          id: event.id,
          content: event.content,
          created_at: event.created_at,
          pubkey: event.pubkey,
          kind: event.kind,
          tags: event.tags,
          parsedContent: parsedContent,
          type: isArticle ? 'article' : 'event'
        }
      })
    } catch (error) {
      console.error('Error fetching individual bookmarks:', error)
      return []
    }
  }

  const parseBookmarkEvent = async (event: NostrEvent): Promise<Bookmark | null> => {
    try {
      // According to NIP-51, bookmark lists (kind 10003) contain:
      // - "e" tags for event references (the actual bookmarks)
      // - "a" tags for article references
      // - "r" tags for URL references
      
      const eventTags = event.tags.filter((tag: string[]) => tag[0] === 'e')
      const articleTags = event.tags.filter((tag: string[]) => tag[0] === 'a')
      const urlTags = event.tags.filter((tag: string[]) => tag[0] === 'r')
      
      // Use applesauce-content to parse the content properly
      const parsedContent = event.content ? getParsedContent(event.content) as ParsedContent : undefined
      
      // Get the title from content or use a default
      const title = event.content || `Bookmark List (${eventTags.length + articleTags.length + urlTags.length} items)`
      
      // For now, skip individual bookmark fetching to test basic functionality
      // TODO: Re-enable individual bookmark fetching once basic flow works
      const eventIds = eventTags.map(tag => tag[1])
      const articleIds = articleTags.map(tag => tag[1])
      console.log('Would fetch individual bookmarks for eventIds:', eventIds.length, 'articleIds:', articleIds.length)
      const individualBookmarks: IndividualBookmark[] = [] // Temporarily disabled
      console.log('Individual bookmarks disabled for now:', individualBookmarks.length)
      
      return {
        id: event.id,
        title: title,
        url: '', // Bookmark lists don't have a single URL
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        parsedContent: parsedContent,
        // Add metadata about the bookmark list
        bookmarkCount: eventTags.length + articleTags.length + urlTags.length,
        eventReferences: eventIds,
        articleReferences: articleIds,
        urlReferences: urlTags.map(tag => tag[1]),
        individualBookmarks: individualBookmarks
      }
    } catch (error) {
      console.error('Error parsing bookmark event:', error)
      return null
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  // Component to render parsed content using applesauce-content
  const renderParsedContent = (parsedContent: ParsedContent) => {
    if (!parsedContent || !parsedContent.children) {
      return null
    }

    const renderNode = (node: ParsedNode, index: number): React.ReactNode => {
      if (node.type === 'text') {
        return <span key={index}>{node.value}</span>
      }
      
      if (node.type === 'mention') {
        return (
          <a 
            key={index}
            href={`nostr:${node.encoded}`}
            className="nostr-mention"
            target="_blank"
            rel="noopener noreferrer"
          >
            {node.encoded}
          </a>
        )
      }
      
      if (node.type === 'link') {
        return (
          <a 
            key={index}
            href={node.url}
            className="nostr-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {node.url}
          </a>
        )
      }
      
      if (node.children) {
        return (
          <span key={index}>
            {node.children.map((child: ParsedNode, childIndex: number) => 
              renderNode(child, childIndex)
            )}
          </span>
        )
      }
      
      return null
    }

    return (
      <div className="parsed-content">
        {parsedContent.children.map((node: ParsedNode, index: number) => 
          renderNode(node, index)
        )}
      </div>
    )
  }

  // Component to render individual bookmarks
  const renderIndividualBookmark = (bookmark: IndividualBookmark, index: number) => {
    return (
      <div key={`${bookmark.id}-${index}`} className="individual-bookmark">
        <div className="bookmark-header">
          <span className="bookmark-type">{bookmark.type}</span>
          <span className="bookmark-id">{bookmark.id.slice(0, 8)}...{bookmark.id.slice(-8)}</span>
          <span className="bookmark-date">{formatDate(bookmark.created_at)}</span>
        </div>
        
        {bookmark.parsedContent ? (
          <div className="bookmark-content">
            {renderParsedContent(bookmark.parsedContent)}
          </div>
        ) : bookmark.content && (
          <div className="bookmark-content">
            <p>{bookmark.content}</p>
          </div>
        )}
        
        <div className="bookmark-meta">
          <span>Kind: {bookmark.kind}</span>
          <span>Author: {bookmark.pubkey.slice(0, 8)}...{bookmark.pubkey.slice(-8)}</span>
        </div>
      </div>
    )
  }

  const formatUserDisplay = () => {
    if (!activeAccount) return 'Unknown User'

    // Use profile data from ProfileModel if available
    if (profile?.name) {
      return profile.name
    }
    if (profile?.display_name) {
      return profile.display_name
    }
    if (profile?.nip05) {
      return profile.nip05
    }

    // Fallback to formatted public key
    return `${activeAccount.pubkey.slice(0, 8)}...${activeAccount.pubkey.slice(-8)}`
  }

  if (loading) {
    return (
      <div className="bookmarks-container">
        <div className="bookmarks-header">
          <div>
            <h2>Your Bookmarks</h2>
            {activeAccount && (
              <p className="user-info">Logged in as: {formatUserDisplay()}</p>
            )}
          </div>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
        <div className="loading">Loading bookmarks...</div>
      </div>
    )
  }

  return (
    <div className="bookmarks-container">
      <div className="bookmarks-header">
        <div>
          <h2>Your Bookmarks ({bookmarks.length})</h2>
          {activeAccount && (
            <p className="user-info">Logged in as: {formatUserDisplay()}</p>
          )}
        </div>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </div>
      
      {bookmarks.length === 0 ? (
        <div className="empty-state">
          <p>No bookmarks found.</p>
          <p>Add bookmarks using your nostr client to see them here.</p>
        </div>
      ) : (
        <div className="bookmarks-list">
          {bookmarks.map((bookmark, index) => (
            <div key={`${bookmark.id}-${index}`} className="bookmark-item">
              <h3>{bookmark.title}</h3>
              {bookmark.bookmarkCount && (
                <p className="bookmark-count">
                  {bookmark.bookmarkCount} bookmarks in this list
                </p>
              )}
              {bookmark.urlReferences && bookmark.urlReferences.length > 0 && (
                <div className="bookmark-urls">
                  <h4>URLs:</h4>
                  {bookmark.urlReferences.map((url, index) => (
                    <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="bookmark-url">
                      {url}
                    </a>
                  ))}
                </div>
              )}
              {bookmark.individualBookmarks && bookmark.individualBookmarks.length > 0 && (
                <div className="individual-bookmarks">
                  <h4>Individual Bookmarks ({bookmark.individualBookmarks.length}):</h4>
                  <div className="bookmarks-grid">
                    {bookmark.individualBookmarks.map((individualBookmark, index) => 
                      renderIndividualBookmark(individualBookmark, index)
                    )}
                  </div>
                </div>
              )}
              {bookmark.eventReferences && bookmark.eventReferences.length > 0 && bookmark.individualBookmarks?.length === 0 && (
                <div className="bookmark-events">
                  <h4>Event References ({bookmark.eventReferences.length}):</h4>
                  <div className="event-ids">
                    {bookmark.eventReferences.slice(0, 3).map((eventId, index) => (
                      <span key={index} className="event-id">
                        {eventId.slice(0, 8)}...{eventId.slice(-8)}
                      </span>
                    ))}
                    {bookmark.eventReferences.length > 3 && (
                      <span className="more-events">... and {bookmark.eventReferences.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
              {bookmark.parsedContent ? (
                <div className="bookmark-content">
                  {renderParsedContent(bookmark.parsedContent)}
                </div>
              ) : bookmark.content && (
                <p className="bookmark-content">{bookmark.content}</p>
              )}
              <div className="bookmark-meta">
                <span>Created: {formatDate(bookmark.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Bookmarks
