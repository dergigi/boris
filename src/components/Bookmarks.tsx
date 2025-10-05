import React, { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { useEventStore } from 'applesauce-react/hooks'
import { RelayPool } from 'applesauce-relay'
import { EventFactory } from 'applesauce-factory'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { BookmarkList } from './BookmarkList'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights } from '../services/highlightService'
import ContentPanel from './ContentPanel'
import { HighlightsPanel } from './HighlightsPanel'
import { fetchReadableContent, ReadableContent } from '../services/readerService'
import Settings from './Settings'
import { UserSettings, loadSettings, saveSettings } from '../services/settingsService'
import { loadFont, getFontFamily } from '../utils/fontLoader'

export type ViewMode = 'compact' | 'cards' | 'large'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const RELAY_URLS = [
  'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band',
  'wss://relay.dergigi.com', 'wss://wot.dergigi.com'
]

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
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [showUnderlines, setShowUnderlines] = useState(true)
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({})
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const eventStore = useEventStore()

  useEffect(() => {
    console.log('Bookmarks useEffect triggered')
    console.log('relayPool:', !!relayPool)
    console.log('activeAccount:', !!activeAccount)
    if (relayPool && activeAccount) {
      console.log('Starting to fetch bookmarks and highlights...')
      handleFetchBookmarks()
      handleFetchHighlights()
      handleLoadSettings()
    } else {
      console.log('Not fetching bookmarks - missing dependencies')
    }
  }, [relayPool, activeAccount?.pubkey])

  useEffect(() => {
    if (settings.defaultViewMode) setViewMode(settings.defaultViewMode)
    if (settings.showUnderlines !== undefined) setShowUnderlines(settings.showUnderlines)
    if (settings.sidebarCollapsed !== undefined) setIsCollapsed(settings.sidebarCollapsed)
    if (settings.highlightsCollapsed !== undefined) setIsHighlightsCollapsed(settings.highlightsCollapsed)
    if (settings.readingFont) {
      loadFont(settings.readingFont)
      // Apply font to content panel
      const fontFamily = getFontFamily(settings.readingFont)
      document.documentElement.style.setProperty('--reading-font', fontFamily)
    }
  }, [settings])

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

  const handleLoadSettings = async () => {
    if (!relayPool || !activeAccount) return
    try {
      const loadedSettings = await loadSettings(relayPool, eventStore, activeAccount.pubkey, RELAY_URLS)
      if (loadedSettings) {
        setSettings(loadedSettings)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  const handleSaveSettings = async (newSettings: UserSettings) => {
    if (!relayPool || !activeAccount) return
    setIsSavingSettings(true)
    try {
      const fullAccount = accountManager.getActive()
      if (!fullAccount) throw new Error('No active account')
      const factory = new EventFactory({ signer: fullAccount })
      await saveSettings(relayPool, eventStore, factory, newSettings, RELAY_URLS)
      setSettings(newSettings)
      setShowSettings(false)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleSelectUrl = async (url: string) => {
    setSelectedUrl(url)
    setReaderLoading(true)
    setReaderContent(undefined)
    
    // Collapse sidebar if setting is enabled (default true)
    if (settings.collapseOnArticleOpen !== false) {
      setIsCollapsed(true)
    }
    
    try {
      const content = await fetchReadableContent(url)
      setReaderContent(content)
    } catch (err) {
      console.warn('Failed to fetch readable content:', err)
    } finally {
      setReaderLoading(false)
    }
  }

  const handleHighlightClick = (highlightId: string) => {
    setSelectedHighlightId(highlightId)
    // Open highlights panel if it's collapsed
    if (isHighlightsCollapsed) {
      setIsHighlightsCollapsed(false)
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
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
            isSaving={isSavingSettings}
          />
        ) : (
          <ContentPanel 
            loading={readerLoading}
            title={readerContent?.title}
            html={readerContent?.html}
            markdown={readerContent?.markdown}
            selectedUrl={selectedUrl}
            highlights={highlights}
            showUnderlines={showUnderlines}
            onHighlightClick={handleHighlightClick}
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
            onHighlightClick={handleHighlightClick}
          />
        </div>
      </div>
    </>
  )
}

export default Bookmarks
