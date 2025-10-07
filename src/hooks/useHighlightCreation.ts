import { useCallback, useRef } from 'react'
import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../types/highlights'
import { ReadableContent } from '../services/readerService'
import { createHighlight, eventToHighlight } from '../services/highlightCreationService'
import { HighlightButtonRef } from '../components/HighlightButton'

interface UseHighlightCreationParams {
  activeAccount: any
  relayPool: RelayPool | null
  currentArticle: NostrEvent | undefined
  selectedUrl: string | undefined
  readerContent: ReadableContent | undefined
  onHighlightCreated: (highlight: Highlight) => void
}

export const useHighlightCreation = ({
  activeAccount,
  relayPool,
  currentArticle,
  selectedUrl,
  readerContent,
  onHighlightCreated
}: UseHighlightCreationParams) => {
  const highlightButtonRef = useRef<HighlightButtonRef>(null)

  const handleTextSelection = useCallback((text: string) => {
    highlightButtonRef.current?.updateSelection(text)
  }, [])

  const handleClearSelection = useCallback(() => {
    highlightButtonRef.current?.clearSelection()
  }, [])

  const handleCreateHighlight = useCallback(async (text: string) => {
    if (!activeAccount || !relayPool) {
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
      
      const signedEvent = await createHighlight(
        text,
        source,
        activeAccount,
        relayPool,
        contentForContext
      )
      
      console.log('✅ Highlight created successfully!')
      highlightButtonRef.current?.clearSelection()
      
      const newHighlight = eventToHighlight(signedEvent)
      onHighlightCreated(newHighlight)
    } catch (error) {
      console.error('Failed to create highlight:', error)
    }
  }, [activeAccount, relayPool, currentArticle, selectedUrl, readerContent, onHighlightCreated])

  return {
    highlightButtonRef,
    handleTextSelection,
    handleClearSelection,
    handleCreateHighlight
  }
}

