import { useState, useEffect } from 'react'
import { NostrEvent } from 'nostr-tools'
import { HighlightVisibility } from '../components/HighlightsPanel'
import { UserSettings } from '../services/settingsService'
import { ViewMode } from '../components/Bookmarks'

interface UseBookmarksUIParams {
  settings: UserSettings
}

export const useBookmarksUI = ({ settings }: UseBookmarksUIParams) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isHighlightsCollapsed, setIsHighlightsCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [showHighlights, setShowHighlights] = useState(true)
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [currentArticleCoordinate, setCurrentArticleCoordinate] = useState<string | undefined>(undefined)
  const [currentArticleEventId, setCurrentArticleEventId] = useState<string | undefined>(undefined)
  const [currentArticle, setCurrentArticle] = useState<NostrEvent | undefined>(undefined)
  const [highlightVisibility, setHighlightVisibility] = useState<HighlightVisibility>({
    nostrverse: true,
    friends: true,
    mine: true
  })

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

  return {
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
    showSettings,
    setShowSettings,
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

