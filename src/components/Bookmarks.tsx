import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Hooks } from 'applesauce-react'
import { useEventStore } from 'applesauce-react/hooks'
import { RelayPool } from 'applesauce-relay'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { BookmarkList } from './BookmarkList'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights, fetchHighlightsForArticle } from '../services/highlightService'
import ContentPanel from './ContentPanel'
import { HighlightsPanel } from './HighlightsPanel'
import { ReadableContent } from '../services/readerService'
import Settings from './Settings'
import Toast from './Toast'
import { useSettings } from '../hooks/useSettings'
import { useArticleLoader } from '../hooks/useArticleLoader'
import { loadContent, BookmarkReference } from '../utils/contentLoader'
import { HighlightMode } from './HighlightsPanel'
export type ViewMode = 'compact' | 'cards' | 'large'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ relayPool, onLogout }) => {
  const { naddr } = useParams<{ naddr?: string }>()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerContent, setReaderContent] = useState<ReadableContent | undefined>(undefined)
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed
  const [isHighlightsCollapsed, setIsHighlightsCollapsed] = useState(true) // Start collapsed
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [showUnderlines, setShowUnderlines] = useState(true)
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [currentArticleCoordinate, setCurrentArticleCoordinate] = useState<string | undefined>(undefined)
  const [currentArticleEventId, setCurrentArticleEventId] = useState<string | undefined>(undefined)
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('others')
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const eventStore = useEventStore()
  
  const { settings, saveSettings, toastMessage, toastType, clearToast } = useSettings({
    relayPool,
    eventStore,
    pubkey: activeAccount?.pubkey,
    accountManager
  })

  // Load article if naddr is in URL
  useArticleLoader({
    naddr,
    relayPool,
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setIsHighlightsCollapsed,
    setHighlights,
    setHighlightsLoading,
    setCurrentArticleCoordinate,
    setCurrentArticleEventId
  })

  // Load initial data on login
  useEffect(() => {
    if (!relayPool || !activeAccount) return
    handleFetchBookmarks()
    handleFetchHighlights()
  }, [relayPool, activeAccount?.pubkey])

  // Apply UI settings
  useEffect(() => {
    if (settings.defaultViewMode) setViewMode(settings.defaultViewMode)
    if (settings.showUnderlines !== undefined) setShowUnderlines(settings.showUnderlines)
    if (settings.sidebarCollapsed !== undefined) setIsCollapsed(settings.sidebarCollapsed)
    if (settings.highlightsCollapsed !== undefined) setIsHighlightsCollapsed(settings.highlightsCollapsed)
  }, [settings])

  const handleFetchBookmarks = async () => {
    if (!relayPool || !activeAccount) return
    const fullAccount = accountManager.getActive()
    await fetchBookmarks(relayPool, fullAccount || activeAccount, setBookmarks)
  }

  const handleFetchHighlights = async () => {
    if (!relayPool) return
    
    setHighlightsLoading(true)
    try {
      // If we're viewing an article, fetch highlights for that article
      if (currentArticleCoordinate) {
        const fetchedHighlights = await fetchHighlightsForArticle(
          relayPool, 
          currentArticleCoordinate, 
          currentArticleEventId
        )
        console.log(`🔄 Refreshed ${fetchedHighlights.length} highlights for article`)
        setHighlights(fetchedHighlights)
      } 
      // Otherwise, if logged in, fetch user's own highlights
      else if (activeAccount) {
        const fetchedHighlights = await fetchHighlights(relayPool, activeAccount.pubkey)
        setHighlights(fetchedHighlights)
      }
    } catch (err) {
      console.error('Failed to fetch highlights:', err)
    } finally {
      setHighlightsLoading(false)
    }
  }

  const handleSelectUrl = async (url: string, bookmark?: BookmarkReference) => {
    if (!relayPool) return
    
    setSelectedUrl(url)
    setReaderLoading(true)
    setReaderContent(undefined)
    setShowSettings(false)
    if (settings.collapseOnArticleOpen !== false) setIsCollapsed(true)
    
    try {
      const content = await loadContent(url, relayPool, bookmark)
      setReaderContent(content)
    } catch (err) {
      console.warn('Failed to fetch content:', err)
    } finally {
      setReaderLoading(false)
    }
  }

  return (
    <>
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
            onOpenSettings={() => {
              setShowSettings(true)
              setIsCollapsed(true)
              setIsHighlightsCollapsed(true)
            }}
          />
        </div>
      <div className="pane main">
        {showSettings ? (
          <Settings 
            settings={settings}
            onSave={saveSettings}
            onClose={() => setShowSettings(false)}
          />
        ) : (
          <ContentPanel 
            loading={readerLoading}
            title={readerContent?.title}
            html={readerContent?.html}
            markdown={readerContent?.markdown}
            image={readerContent?.image}
            selectedUrl={selectedUrl}
            highlights={highlights}
            showUnderlines={showUnderlines}
            highlightStyle={settings.highlightStyle || 'marker'}
            highlightColor={settings.highlightColor || '#ffff00'}
            onHighlightClick={(id) => {
              setSelectedHighlightId(id)
              if (isHighlightsCollapsed) setIsHighlightsCollapsed(false)
            }}
            selectedHighlightId={selectedHighlightId}
          />
        )}
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
            currentUserPubkey={activeAccount?.pubkey}
            highlightMode={highlightMode}
            onHighlightModeChange={setHighlightMode}
          />
        </div>
      </div>
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}
    </>
  )
}

export default Bookmarks
