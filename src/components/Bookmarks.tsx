import React, { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { BookmarkList } from './BookmarkList'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights } from '../services/highlightService'
import ContentPanel from './ContentPanel'
import { HighlightsPanel } from './HighlightsPanel'
import { fetchReadableContent, ReadableContent } from '../services/readerService'

export type ViewMode = 'compact' | 'cards' | 'large'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ relayPool, onLogout }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerContent, setReaderContent] = useState<ReadableContent | undefined>(undefined)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHighlightsCollapsed, setIsHighlightsCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showUnderlines, setShowUnderlines] = useState(true)
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | undefined>(undefined)
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()

  useEffect(() => {
    console.log('Bookmarks useEffect triggered')
    console.log('relayPool:', !!relayPool)
    console.log('activeAccount:', !!activeAccount)
    if (relayPool && activeAccount) {
      console.log('Starting to fetch bookmarks and highlights...')
      handleFetchBookmarks()
      handleFetchHighlights()
    } else {
      console.log('Not fetching bookmarks - missing dependencies')
    }
  }, [relayPool, activeAccount?.pubkey]) // Only depend on pubkey, not the entire activeAccount object

  const handleFetchBookmarks = async () => {
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

    // Get the full account object with extension capabilities
    const fullAccount = accountManager.getActive()
    await fetchBookmarks(relayPool, fullAccount || activeAccount, setBookmarks, setLoading, timeoutId)
  }

  const handleFetchHighlights = async () => {
    if (!relayPool || !activeAccount) {
      return
    }
    
    setHighlightsLoading(true)
    try {
      const fetchedHighlights = await fetchHighlights(relayPool, activeAccount.pubkey)
      setHighlights(fetchedHighlights)
    } catch (err) {
      console.error('Failed to fetch highlights:', err)
    } finally {
      setHighlightsLoading(false)
    }
  }

  const handleSelectUrl = async (url: string) => {
    setSelectedUrl(url)
    setReaderLoading(true)
    setReaderContent(undefined)
    try {
      const content = await fetchReadableContent(url)
      setReaderContent(content)
    } catch (err) {
      console.warn('Failed to fetch readable content:', err)
    } finally {
      setReaderLoading(false)
    }
  }



  if (loading) {
    return (
      <div className="bookmarks-container">
        <div className="loading">Loading bookmarks...</div>
      </div>
    )
  }

  return (
    <div className={`three-pane ${isCollapsed ? 'sidebar-collapsed' : ''} ${isHighlightsCollapsed ? 'highlights-collapsed' : ''}`}>
      <div className="pane sidebar">
        <BookmarkList 
          bookmarks={bookmarks}
          onSelectUrl={handleSelectUrl}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onLogout={onLogout}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedUrl={selectedUrl}
        />
      </div>
      <div className="pane main">
        <ContentPanel 
          loading={readerLoading}
          title={readerContent?.title}
          html={readerContent?.html}
          markdown={readerContent?.markdown}
          selectedUrl={selectedUrl}
          highlights={highlights}
          showUnderlines={showUnderlines}
          onHighlightClick={setSelectedHighlightId}
          selectedHighlightId={selectedHighlightId}
        />
      </div>
      <div className="pane highlights">
        <HighlightsPanel
          highlights={highlights}
          loading={highlightsLoading}
          isCollapsed={isHighlightsCollapsed}
          onToggleCollapse={() => setIsHighlightsCollapsed(!isHighlightsCollapsed)}
          onSelectUrl={handleSelectUrl}
          selectedUrl={selectedUrl}
          onToggleUnderlines={setShowUnderlines}
          selectedHighlightId={selectedHighlightId}
          onRefresh={handleFetchHighlights}
          onHighlightClick={setSelectedHighlightId}
        />
      </div>
    </div>
  )
}

export default Bookmarks
