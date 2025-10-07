import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RelayPool } from 'applesauce-relay'
import { NostrEvent, nip19 } from 'nostr-tools'
import { loadContent, BookmarkReference } from '../utils/contentLoader'
import { ReadableContent } from '../services/readerService'
import { UserSettings } from '../services/settingsService'

interface UseContentSelectionParams {
  relayPool: RelayPool | null
  settings: UserSettings
  setIsCollapsed: (collapsed: boolean) => void
  setShowSettings: (show: boolean) => void
  setCurrentArticle: (article: NostrEvent | undefined) => void
}

export const useContentSelection = ({
  relayPool,
  settings,
  setIsCollapsed,
  setShowSettings,
  setCurrentArticle
}: UseContentSelectionParams) => {
  const navigate = useNavigate()
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerContent, setReaderContent] = useState<ReadableContent | undefined>(undefined)

  const handleSelectUrl = useCallback(async (url: string, bookmark?: BookmarkReference) => {
    if (!relayPool) return
    
    // Update the URL path based on content type
    if (bookmark && bookmark.kind === 30023) {
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1] || ''
      if (dTag && bookmark.pubkey) {
        const pointer = {
          identifier: dTag,
          kind: 30023,
          pubkey: bookmark.pubkey,
        }
        const naddr = nip19.naddrEncode(pointer)
        navigate(`/a/${naddr}`)
      }
    } else if (url) {
      navigate(`/r/${encodeURIComponent(url)}`)
    }
    
    setSelectedUrl(url)
    setReaderLoading(true)
    setReaderContent(undefined)
    setCurrentArticle(undefined)
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
  }, [relayPool, settings, navigate, setIsCollapsed, setShowSettings, setCurrentArticle])

  return {
    selectedUrl,
    setSelectedUrl,
    readerLoading,
    setReaderLoading,
    readerContent,
    setReaderContent,
    handleSelectUrl
  }
}

