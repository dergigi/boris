import { useState, useEffect } from 'react'
import { NostrEvent } from 'nostr-tools'
import { HighlightVisibility } from '../components/HighlightsPanel'
import { UserSettings } from '../services/settingsService'
import { ViewMode } from '../components/Bookmarks'
import { useIsMobile } from './useMediaQuery'

interface UseBookmarksUIParams {
  settings: UserSettings
}

export const useBookmarksUI = ({ settings }: UseBookmarksUIParams) => {
  const isMobile = useIsMobile()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isHighlightsCollapsed, setIsHighlightsCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [showHighlights, setShowHighlights] = useState(true)
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | undefined>(undefined)
  const [currentArticleCoordinate, setCurrentArticleCoordinate] = useState<string | undefined>(undefined)
  const [currentArticleEventId, setCurrentArticleEventId] = useState<string | undefined>(undefined)
  const [currentArticle, setCurrentArticle] = useState<NostrEvent | undefined>(undefined)
  const [highlightVisibility, setHighlightVisibility] = useState<HighlightVisibility>({
    nostrverse: true,
    friends: true,
    mine: true
  })

  // Auto-collapse sidebar on mobile based on settings
  useEffect(() => {
    const autoCollapse = settings.autoCollapseSidebarOnMobile !== false
    if (isMobile && autoCollapse) {
      setIsSidebarOpen(false)
    } else if (!isMobile) {
      setIsSidebarOpen(true)
    }
  }, [isMobile, settings.autoCollapseSidebarOnMobile])

  // Apply UI settings
  useEffect(() => {
    if (settings.defaultViewMode) setViewMode(settings.defaultViewMode)
    if (settings.showHighlights !== undefined) setShowHighlights(settings.showHighlights)
    setHighlightVisibility({
      nostrverse: settings.defaultHighlightVisibilityNostrverse !== false,
      friends: settings.defaultHighlightVisibilityFriends !== false,
      mine: settings.defaultHighlightVisibilityMine !== false
    })
  }, [settings])

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev)
  }

  return {
    isMobile,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    isCollapsed,
    setIsCollapsed,
    isHighlightsCollapsed,
    setIsHighlightsCollapsed,
    viewMode,
    setViewMode,
    showHighlights,
    setShowHighlights,
    selectedHighlightId,
    setSelectedHighlightId,
    currentArticleCoordinate,
    setCurrentArticleCoordinate,
    currentArticleEventId,
    setCurrentArticleEventId,
    currentArticle,
    setCurrentArticle,
    highlightVisibility,
    setHighlightVisibility
  }
}

