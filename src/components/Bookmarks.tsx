import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
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
import { fetchReadableContent, ReadableContent } from '../services/readerService'
import { fetchArticleByNaddr } from '../services/articleService'
import Settings from './Settings'
import Toast from './Toast'
import { useSettings } from '../hooks/useSettings'
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
  useEffect(() => {
    if (!relayPool || !naddr) return
    
    const loadArticle = async () => {
      setReaderLoading(true)
      setReaderContent(undefined)
      setSelectedUrl(`nostr:${naddr}`) // Use naddr as the URL identifier
      setIsCollapsed(true)
      setIsHighlightsCollapsed(false) // Show highlights for the article
      
      try {
        const article = await fetchArticleByNaddr(relayPool, naddr)
        setReaderContent({
          title: article.title,
          markdown: article.markdown,
          image: article.image,
          url: `nostr:${naddr}`
        })
        
        // Fetch highlights for this article using its address coordinate
        // Extract the d-tag identifier from the article event
        const dTag = article.event.tags.find(t => t[0] === 'd')?.[1] || ''
        const articleCoordinate = `${article.event.kind}:${article.author}:${dTag}`
        
        // Store article info for refresh functionality
        setCurrentArticleCoordinate(articleCoordinate)
        setCurrentArticleEventId(article.event.id)
        
        console.log('📰 Article details:')
        console.log('  - Event ID:', article.event.id)
        console.log('  - Author:', article.author)
        console.log('  - Kind:', article.event.kind)
        console.log('  - D-tag:', dTag)
        console.log('  - Coordinate:', articleCoordinate)
        console.log('  - Title:', article.title)
        
        try {
          setHighlightsLoading(true)
          // Pass both the article coordinate and event ID for comprehensive highlight fetching
          const fetchedHighlights = await fetchHighlightsForArticle(relayPool, articleCoordinate, article.event.id)
          console.log(`📌 Found ${fetchedHighlights.length} highlights for article ${articleCoordinate}`)
          setHighlights(fetchedHighlights)
        } catch (err) {
          console.error('Failed to fetch highlights:', err)
        } finally {
          setHighlightsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load article:', err)
        setReaderContent({
          title: 'Error Loading Article',
          html: `<p>Failed to load article: ${err instanceof Error ? err.message : 'Unknown error'}</p>`,
          url: `nostr:${naddr}`
        })
        setReaderLoading(false)
      } finally {
        setReaderLoading(false)
      }
    }
    
    loadArticle()
  }, [naddr, relayPool])

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

  const handleSelectUrl = async (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => {
    if (!relayPool) return
    
    setSelectedUrl(url)
    setReaderLoading(true)
    setReaderContent(undefined)
    setShowSettings(false)
    if (settings.collapseOnArticleOpen !== false) setIsCollapsed(true)
    
    try {
      // Check if this is a kind:30023 article
      if (bookmark && bookmark.kind === 30023) {
        // For articles, construct an naddr and fetch using article service
        const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1] || ''
        
        if (dTag !== undefined && bookmark.pubkey) {
          const pointer = {
            identifier: dTag,
            kind: 30023,
            pubkey: bookmark.pubkey,
          }
          const naddr = nip19.naddrEncode(pointer)
          const article = await fetchArticleByNaddr(relayPool, naddr)
          setReaderContent({
            title: article.title,
            markdown: article.markdown,
            image: article.image,
            url: `nostr:${naddr}`
          })
        } else {
          throw new Error('Invalid article reference - missing d tag or pubkey')
        }
      } else {
        // For regular URLs, fetch readable content
        const content = await fetchReadableContent(url)
        setReaderContent(content)
      }
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
