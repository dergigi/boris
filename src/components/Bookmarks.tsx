import React, { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { completeOnEose } from 'applesauce-relay'
import { getParsedContent } from 'applesauce-content/text'
import { Filter } from 'nostr-tools'
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
    console.log('🔍 fetchBookmarks called, loading:', loading)
    if (!relayPool || !activeAccount) {
      console.log('🔍 fetchBookmarks early return - relayPool:', !!relayPool, 'activeAccount:', !!activeAccount)
      return
    }

    // Set a timeout to ensure loading state gets reset
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout reached, resetting loading state')
      setLoading(false)
    }, 15000) // 15 second timeout

    try {
      setLoading(true)
      console.log('🚀 NEW VERSION: Fetching bookmark list for pubkey:', activeAccount.pubkey)
      
      // Get relay URLs from the pool
      const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
      
      // Step 1: Fetch the bookmark list event (kind 10003)
      const bookmarkListFilter: Filter = {
        kinds: [10003],
        authors: [activeAccount.pubkey],
        limit: 1 // Just get the most recent bookmark list
      }
      
      console.log('Fetching bookmark list with filter:', bookmarkListFilter)
      const bookmarkListEvents = await lastValueFrom(
        relayPool.req(relayUrls, bookmarkListFilter).pipe(
          completeOnEose(),
          takeUntil(timer(10000)),
          toArray(),
        )
      )
      
      console.log('Found bookmark list events:', bookmarkListEvents.length)
      
      if (bookmarkListEvents.length === 0) {
        console.log('No bookmark list found')
        setBookmarks([])
        setLoading(false)
        return
      }
      
      // Step 2: Extract event IDs from the bookmark list
      const bookmarkListEvent = bookmarkListEvents[0]
      const eventTags = bookmarkListEvent.tags.filter(tag => tag[0] === 'e')
      const eventIds = eventTags.map(tag => tag[1])
      
      console.log('Found event IDs in bookmark list:', eventIds.length, eventIds)
      
      if (eventIds.length === 0) {
        console.log('No event references found in bookmark list')
        setBookmarks([])
        setLoading(false)
        return
      }
      
      // Step 3: Fetch each individual event
      console.log('Fetching individual events...')
      const individualBookmarks: IndividualBookmark[] = []
      
      for (const eventId of eventIds) {
        try {
          console.log('Fetching event:', eventId)
          const eventFilter: Filter = {
            ids: [eventId]
          }
          
          const events = await lastValueFrom(
            relayPool.req(relayUrls, eventFilter).pipe(
              completeOnEose(),
              takeUntil(timer(5000)),
              toArray(),
            )
          )
          
          if (events.length > 0) {
            const event = events[0]
            const parsedContent = event.content ? getParsedContent(event.content) as ParsedContent : undefined
            
            individualBookmarks.push({
              id: event.id,
              content: event.content,
              created_at: event.created_at,
              pubkey: event.pubkey,
              kind: event.kind,
              tags: event.tags,
              parsedContent: parsedContent,
              type: 'event'
            })
            console.log('Successfully fetched event:', event.id)
          } else {
            console.log('Event not found:', eventId)
          }
        } catch (error) {
          console.error('Error fetching event:', eventId, error)
        }
      }
      
      console.log('Fetched individual bookmarks:', individualBookmarks.length)
      
      // Create a single bookmark entry with all individual bookmarks
      const bookmark: Bookmark = {
        id: bookmarkListEvent.id,
        title: bookmarkListEvent.content || `Bookmark List (${individualBookmarks.length} items)`,
        url: '',
        content: bookmarkListEvent.content,
        created_at: bookmarkListEvent.created_at,
        tags: bookmarkListEvent.tags,
        bookmarkCount: individualBookmarks.length,
        eventReferences: eventIds,
        individualBookmarks: individualBookmarks
      }
      
      setBookmarks([bookmark])
      clearTimeout(timeoutId)
      setLoading(false)

    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
      clearTimeout(timeoutId)
      setLoading(false)
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
