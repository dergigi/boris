import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { BookmarkList } from './BookmarkList'
import ContentPanel from './ContentPanel'
import { HighlightsPanel } from './HighlightsPanel'
import Settings from './Settings'
import Toast from './Toast'
import { HighlightButton } from './HighlightButton'
import { RelayStatusIndicator } from './RelayStatusIndicator'
import { ViewMode } from './Bookmarks'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { ReadableContent } from '../services/readerService'
import { UserSettings } from '../services/settingsService'
import { HighlightVisibility } from './HighlightsPanel'
import { HighlightButtonRef } from './HighlightButton'
import { BookmarkReference } from '../utils/contentLoader'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'

interface ThreePaneLayoutProps {
  // Layout state
  isCollapsed: boolean
  isHighlightsCollapsed: boolean
  isSidebarOpen: boolean
  showSettings: boolean
  showExplore?: boolean
  showMe?: boolean
  showProfile?: boolean
  showSupport?: boolean
  
  // Bookmarks pane
  bookmarks: Bookmark[]
  bookmarksLoading: boolean
  viewMode: ViewMode
  isRefreshing: boolean
  lastFetchTime?: number | null
  onToggleSidebar: () => void
  onLogout: () => void
  onViewModeChange: (mode: ViewMode) => void
  onOpenSettings: () => void
  onRefresh: () => void
  relayPool: RelayPool | null
  eventStore: IEventStore | null
  
  // Content pane
  readerLoading: boolean
  readerContent?: ReadableContent
  selectedUrl?: string
  settings: UserSettings
  onSaveSettings: (settings: UserSettings) => Promise<void>
  onCloseSettings: () => void
  classifiedHighlights: Highlight[]
  showHighlights: boolean
  selectedHighlightId?: string
  highlightVisibility: HighlightVisibility
  onHighlightClick: (id: string) => void
  onTextSelection: (text: string) => void
  onClearSelection: () => void
  currentUserPubkey?: string
  followedPubkeys: Set<string>
  activeAccount?: IAccount | null
  currentArticle?: NostrEvent | null
  
  // Highlights pane
  highlights: Highlight[]
  highlightsLoading: boolean
  onToggleHighlightsPanel: () => void
  onSelectUrl: (url: string, bookmark?: BookmarkReference) => void
  onToggleHighlights: (show: boolean) => void
  onRefreshHighlights: () => void
  onHighlightVisibilityChange: (visibility: HighlightVisibility) => void
  
  // Highlight button
  highlightButtonRef: React.RefObject<HighlightButtonRef>
  onCreateHighlight: (text: string) => void
  hasActiveAccount: boolean
  
  // Toast
  toastMessage?: string
  toastType?: 'success' | 'error'
  onClearToast: () => void
  
  // Optional Explore content
  explore?: React.ReactNode
  
  // Optional Me content
  me?: React.ReactNode
  
  // Optional Profile content
  profile?: React.ReactNode
  
  // Optional Support content
  support?: React.ReactNode
}

const ThreePaneLayout: React.FC<ThreePaneLayoutProps> = (props) => {
  const isMobile = useIsMobile()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const highlightsRef = useRef<HTMLDivElement>(null)
  const mainPaneRef = useRef<HTMLDivElement>(null)
  
  // Detect scroll direction and position to hide/show mobile buttons
  // Only hide on scroll down when viewing article content
  const isViewingArticle = !!(props.selectedUrl)
  const scrollDirection = useScrollDirection({ 
    threshold: 10, 
    enabled: isMobile && !props.isSidebarOpen && props.isHighlightsCollapsed && isViewingArticle
  })
  
  // Track if we're at the top of the page
  const [isAtTop, setIsAtTop] = useState(true)
  useEffect(() => {
    if (!isMobile || !isViewingArticle) return
    
    const handleScroll = () => {
      setIsAtTop(window.scrollY <= 10)
    }
    
    handleScroll() // Check initial position
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile, isViewingArticle])
  
  // Bookmark button: hide only when scrolling down
  const showBookmarkButton = scrollDirection !== 'down'
  // Highlights button: hide when scrolling down OR at the top
  const showHighlightsButton = scrollDirection !== 'down' && !isAtTop

  // Lock body scroll when mobile sidebar or highlights is open
  useEffect(() => {
    if (isMobile && (props.isSidebarOpen || !props.isHighlightsCollapsed)) {
      document.body.classList.add('mobile-sidebar-open')
    } else {
      document.body.classList.remove('mobile-sidebar-open')
    }
    
    return () => {
      document.body.classList.remove('mobile-sidebar-open')
    }
  }, [isMobile, props.isSidebarOpen, props.isHighlightsCollapsed])

  // Handle ESC key to close sidebar or highlights
  useEffect(() => {
    const { isSidebarOpen, isHighlightsCollapsed, onToggleSidebar, onToggleHighlightsPanel } = props
    
    if (!isMobile) return
    if (!isSidebarOpen && isHighlightsCollapsed) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSidebarOpen) {
          onToggleSidebar()
        } else if (!isHighlightsCollapsed) {
          onToggleHighlightsPanel()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMobile, props])

  // Trap focus in sidebar when open on mobile
  useEffect(() => {
    if (!isMobile || !props.isSidebarOpen || !sidebarRef.current) return

    const sidebar = sidebarRef.current
    const focusableElements = sidebar.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    sidebar.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => {
      sidebar.removeEventListener('keydown', handleTab)
    }
  }, [isMobile, props.isSidebarOpen])

  // Trap focus in highlights panel when open on mobile
  useEffect(() => {
    if (!isMobile || props.isHighlightsCollapsed || !highlightsRef.current) return

    const highlights = highlightsRef.current
    const focusableElements = highlights.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    highlights.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => {
      highlights.removeEventListener('keydown', handleTab)
    }
  }, [isMobile, props.isHighlightsCollapsed])

  const handleBackdropClick = () => {
    if (isMobile) {
      if (props.isSidebarOpen) {
        props.onToggleSidebar()
      } else if (!props.isHighlightsCollapsed) {
        props.onToggleHighlightsPanel()
      }
    }
  }

  return (
    <>
      {/* Mobile bookmark button - always show except on settings page */}
      {isMobile && !props.isSidebarOpen && props.isHighlightsCollapsed && !props.showSettings && (
        <button
          className={`fixed z-[900] bg-zinc-800/70 border border-zinc-600/40 rounded-lg text-zinc-200 flex items-center justify-center transition-all duration-300 active:scale-95 backdrop-blur-sm md:hidden ${
            showBookmarkButton ? 'opacity-90 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
          style={{
            top: 'calc(1rem + env(safe-area-inset-top))',
            left: 'calc(1rem + env(safe-area-inset-left))',
            width: '40px',
            height: '40px'
          }}
          onClick={props.onToggleSidebar}
          aria-label="Open bookmarks"
          aria-expanded={props.isSidebarOpen}
        >
          <FontAwesomeIcon icon={faBookmark} size="sm" />
        </button>
      )}

      {/* Mobile highlights button - only show when viewing article content */}
      {isMobile && !props.isSidebarOpen && props.isHighlightsCollapsed && !props.showSettings && isViewingArticle && (
        <button
          className={`fixed z-[900] border border-zinc-600/40 rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95 backdrop-blur-sm md:hidden ${
            showHighlightsButton ? 'opacity-90 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
          style={{ 
            top: 'calc(1rem + env(safe-area-inset-top))',
            right: 'calc(1rem + env(safe-area-inset-right))',
            width: '40px',
            height: '40px',
            backgroundColor: `${props.settings.highlightColorMine || '#fde047'}B3`,
            color: '#000'
          }}
          onClick={props.onToggleHighlightsPanel}
          aria-label="Open highlights"
          aria-expanded={!props.isHighlightsCollapsed}
        >
          <FontAwesomeIcon icon={faHighlighter} size="sm" />
        </button>
      )}

      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-black/45 z-[999] transition-opacity duration-300 ${
            (props.isSidebarOpen || !props.isHighlightsCollapsed) ? 'block opacity-100' : 'hidden opacity-0'
          }`}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      <div className={`three-pane ${props.isCollapsed ? 'sidebar-collapsed' : ''} ${props.isHighlightsCollapsed ? 'highlights-collapsed' : ''}`}>
        <div 
          ref={sidebarRef}
          className={`pane sidebar ${isMobile && props.isSidebarOpen ? 'mobile-open' : ''}`}
          aria-hidden={isMobile && !props.isSidebarOpen}
        >
          <BookmarkList 
            bookmarks={props.bookmarks}
            onSelectUrl={props.onSelectUrl}
            isCollapsed={isMobile ? false : props.isCollapsed}
            onToggleCollapse={props.onToggleSidebar}
            onLogout={props.onLogout}
            viewMode={props.viewMode}
            onViewModeChange={props.onViewModeChange}
            selectedUrl={props.selectedUrl}
            onOpenSettings={props.onOpenSettings}
            onRefresh={props.onRefresh}
            isRefreshing={props.isRefreshing}
            lastFetchTime={props.lastFetchTime}
            loading={props.bookmarksLoading}
            relayPool={props.relayPool}
            isMobile={isMobile}
            settings={props.settings}
          />
        </div>
        <div 
          ref={mainPaneRef}
          className={`pane main ${isMobile && (props.isSidebarOpen || !props.isHighlightsCollapsed) ? 'mobile-hidden' : ''}`}
        >
          {props.showSettings ? (
            <Settings 
              settings={props.settings}
              onSave={props.onSaveSettings}
              onClose={props.onCloseSettings}
              relayPool={props.relayPool}
            />
          ) : props.showExplore && props.explore ? (
            // Render Explore inside the main pane to keep side panels
            <>
              {props.explore}
            </>
          ) : props.showMe && props.me ? (
            // Render Me inside the main pane to keep side panels
            <>
              {props.me}
            </>
          ) : props.showProfile && props.profile ? (
            // Render Profile inside the main pane to keep side panels
            <>
              {props.profile}
            </>
          ) : props.showSupport && props.support ? (
            // Render Support inside the main pane to keep side panels
            <>
              {props.support}
            </>
          ) : (
            <ContentPanel 
              loading={props.readerLoading}
              title={props.readerContent?.title}
              html={props.readerContent?.html}
              markdown={props.readerContent?.markdown}
              image={props.readerContent?.image}
              summary={props.readerContent?.summary}
              published={props.readerContent?.published}
              selectedUrl={props.selectedUrl}
              highlights={props.selectedUrl && props.selectedUrl.startsWith('nostr:')
                ? props.highlights // article-specific highlights only
                : props.classifiedHighlights}
              showHighlights={props.showHighlights}
              highlightStyle={props.settings.highlightStyle || 'marker'}
              highlightColor={props.settings.highlightColor || '#ffff00'}
              onHighlightClick={props.onHighlightClick}
              selectedHighlightId={props.selectedHighlightId}
              highlightVisibility={props.highlightVisibility}
              onTextSelection={props.onTextSelection}
              onClearSelection={props.onClearSelection}
              currentUserPubkey={props.currentUserPubkey}
              followedPubkeys={props.followedPubkeys}
              settings={props.settings}
              relayPool={props.relayPool}
              activeAccount={props.activeAccount}
              currentArticle={props.currentArticle}
              isSidebarCollapsed={props.isCollapsed}
              isHighlightsCollapsed={props.isHighlightsCollapsed}
              onOpenHighlights={() => {
                if (props.isHighlightsCollapsed) {
                  props.onToggleHighlightsPanel()
                }
              }}
            />
          )}
        </div>
        <div 
          ref={highlightsRef}
          className={`pane highlights ${isMobile && !props.isHighlightsCollapsed ? 'mobile-open' : ''}`}
          aria-hidden={isMobile && props.isHighlightsCollapsed}
        >
          <HighlightsPanel
            highlights={props.highlights}
            loading={props.highlightsLoading}
            isCollapsed={props.isHighlightsCollapsed}
            onToggleCollapse={props.onToggleHighlightsPanel}
            onSelectUrl={props.onSelectUrl}
            selectedUrl={props.selectedUrl}
            onToggleHighlights={props.onToggleHighlights}
            selectedHighlightId={props.selectedHighlightId}
            onRefresh={props.onRefreshHighlights}
            onHighlightClick={props.onHighlightClick}
            currentUserPubkey={props.currentUserPubkey}
            highlightVisibility={props.highlightVisibility}
            onHighlightVisibilityChange={props.onHighlightVisibilityChange}
            followedPubkeys={props.followedPubkeys}
            relayPool={props.relayPool}
            eventStore={props.eventStore}
            settings={props.settings}
            isMobile={isMobile}
          />
        </div>
      </div>
      {props.hasActiveAccount && props.readerContent && (
        <HighlightButton 
          ref={props.highlightButtonRef} 
          onHighlight={props.onCreateHighlight}
          highlightColor={props.settings.highlightColorMine || '#ffff00'}
        />
      )}
      <RelayStatusIndicator 
        relayPool={props.relayPool}
        showOnMobile={showBookmarkButton}
      />
      {props.toastMessage && (
        <Toast
          message={props.toastMessage}
          type={props.toastType}
          onClose={props.onClearToast}
        />
      )}
    </>
  )
}

export default ThreePaneLayout

