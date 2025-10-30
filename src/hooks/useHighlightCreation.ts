import { useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { IAccount } from 'applesauce-accounts'
import { Highlight } from '../types/highlights'
import { ReadableContent } from '../services/readerService'
import { createHighlight } from '../services/highlightCreationService'
import { HighlightButtonRef } from '../components/HighlightButton'
import { UserSettings } from '../services/settingsService'
import { useToast } from './useToast'

interface UseHighlightCreationParams {
  activeAccount: IAccount | undefined
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
  const { showToast } = useToast()

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
      
      // Highlight created successfully
      // Clear the browser's text selection immediately to allow DOM update
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
      }
      
      highlightButtonRef.current?.clearSelection()
      
      // Force synchronous render to show highlight immediately
      flushSync(() => {
        onHighlightCreated(newHighlight)
      })
    } catch (error) {
      console.error('❌ Failed to create highlight:', error)
      
      // Show user-friendly error messages
      const errorMessage = error instanceof Error ? error.message : 'Failed to create highlight'
      if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('unauthorized')) {
        showToast('Reconnect bunker and approve signing permissions to create highlights')
      } else {
        showToast(`Failed to create highlight: ${errorMessage}`)
      }
      
      // Re-throw to allow parent to handle
      throw error
    }
  }, [activeAccount, relayPool, eventStore, currentArticle, selectedUrl, readerContent, onHighlightCreated, settings, showToast])

  return {
    highlightButtonRef,
    handleTextSelection,
    handleClearSelection,
    handleCreateHighlight
  }
}

