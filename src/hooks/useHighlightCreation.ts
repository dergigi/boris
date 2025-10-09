import { useCallback, useRef } from 'react'
import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { Highlight } from '../types/highlights'
import { ReadableContent } from '../services/readerService'
import { createHighlight } from '../services/highlightCreationService'
import { HighlightButtonRef } from '../components/HighlightButton'
import { UserSettings } from '../services/settingsService'

interface UseHighlightCreationParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeAccount: any
  relayPool: RelayPool | null
  eventStore: IEventStore | null
  currentArticle: NostrEvent | undefined
  selectedUrl: string | undefined
  readerContent: ReadableContent | undefined
  onHighlightCreated: (highlight: Highlight) => void
  settings?: UserSettings
}

export const useHighlightCreation = ({
  activeAccount,
  relayPool,
  eventStore,
  currentArticle,
  selectedUrl,
  readerContent,
  onHighlightCreated,
  settings
}: UseHighlightCreationParams) => {
  const highlightButtonRef = useRef<HighlightButtonRef>(null)

  const handleTextSelection = useCallback((text: string) => {
    highlightButtonRef.current?.updateSelection(text)
  }, [])

  const handleClearSelection = useCallback(() => {
    highlightButtonRef.current?.clearSelection()
  }, [])

  const handleCreateHighlight = useCallback(async (text: string) => {
    if (!activeAccount || !relayPool || !eventStore) {
      console.error('Missing requirements for highlight creation')
      return
    }

    if (!currentArticle && !selectedUrl) {
      console.error('No source available for highlight creation')
      return
    }

    try {
      const source = currentArticle || selectedUrl!
      const contentForContext = currentArticle 
        ? currentArticle.content 
        : readerContent?.markdown || readerContent?.html
      
      console.log('🎯 Creating highlight...', { text: text.substring(0, 50) + '...' })
      
      const newHighlight = await createHighlight(
        text,
        source,
        activeAccount,
        relayPool,
        eventStore,
        contentForContext,
        undefined,
        settings
      )
      
      console.log('✅ Highlight created successfully!', {
        id: newHighlight.id,
        isLocalOnly: newHighlight.isLocalOnly,
        isOfflineCreated: newHighlight.isOfflineCreated,
        publishedRelays: newHighlight.publishedRelays
      })
      
      highlightButtonRef.current?.clearSelection()
      onHighlightCreated(newHighlight)
    } catch (error) {
      console.error('❌ Failed to create highlight:', error)
      // Re-throw to allow parent to handle
      throw error
    }
  }, [activeAccount, relayPool, eventStore, currentArticle, selectedUrl, readerContent, onHighlightCreated, settings])

  return {
    highlightButtonRef,
    handleTextSelection,
    handleClearSelection,
    handleCreateHighlight
  }
}

