import { useState, useEffect, useCallback } from 'react'
import { IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { EventFactory } from 'applesauce-factory'
import { AccountManager } from 'applesauce-accounts'
import { UserSettings, saveSettings, watchSettings, startSettingsStream } from '../services/settingsService'
import { loadFont, getFontFamily } from '../utils/fontLoader'
import { applyTheme } from '../utils/theme'
import { RELAYS } from '../config/relays'

interface UseSettingsParams {
  relayPool: RelayPool | null
  eventStore: IEventStore
  pubkey: string | undefined
  accountManager: AccountManager
}

export function useSettings({ relayPool, eventStore, pubkey, accountManager }: UseSettingsParams) {
  const [settings, setSettings] = useState<UserSettings>({ renderVideoLinksAsEmbeds: true, hideBotArticlesByName: true })
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // Load settings and set up streaming subscription (non-blocking, EOSE-driven)
  useEffect(() => {
    if (!relayPool || !pubkey || !eventStore) return

    // Start settings stream: seed from store, stream updates to store in background
    const stopNetwork = startSettingsStream(relayPool, eventStore, pubkey, RELAYS, (loadedSettings) => {
      if (loadedSettings) setSettings({ renderVideoLinksAsEmbeds: true, hideBotArticlesByName: true, ...loadedSettings })
    })

    // Also watch store reactively for any further updates
    const subscription = watchSettings(eventStore, pubkey, (loadedSettings) => {
      if (loadedSettings) setSettings({ renderVideoLinksAsEmbeds: true, hideBotArticlesByName: true, ...loadedSettings })
    })

    return () => {
      subscription.unsubscribe()
      stopNetwork()
    }
  }, [relayPool, pubkey, eventStore])

  // Apply settings to document
  useEffect(() => {
    const applyStyles = async () => {
      const root = document.documentElement.style
      const fontKey = settings.readingFont || 'system'
      
      
      // Apply theme with color variants (defaults to 'system' if not set)
      applyTheme(
        settings.theme ?? 'system',
        settings.darkColorTheme ?? 'midnight',
        settings.lightColorTheme ?? 'sepia'
      )
      
      // Load font first and wait for it to be ready
      if (fontKey !== 'system') {
        await loadFont(fontKey)
      }
      
      // Apply font settings after font is loaded
      root.setProperty('--reading-font', getFontFamily(fontKey))
      root.setProperty('--reading-font-size', `${settings.fontSize || 21}px`)
      
      // Set highlight colors for three levels
      root.setProperty('--highlight-color-mine', settings.highlightColorMine || '#fde047')
      root.setProperty('--highlight-color-friends', settings.highlightColorFriends || '#f97316')
      root.setProperty('--highlight-color-nostrverse', settings.highlightColorNostrverse || '#9333ea')
      
      // Set link color
      root.setProperty('--link-color', settings.linkColor || '#38bdf8')
      
      // Set paragraph alignment
      root.setProperty('--paragraph-alignment', settings.paragraphAlignment || 'justify')
      
      // Set image width and max-height based on full-width setting
      root.setProperty('--image-width', settings.fullWidthImages ? '100%' : 'auto')
      root.setProperty('--image-max-height', settings.fullWidthImages ? 'none' : '70vh')
      
    }
    
    applyStyles()
  }, [settings])

  const saveSettingsWithToast = useCallback(async (newSettings: UserSettings) => {
    if (!relayPool || !pubkey) return
    try {
      const fullAccount = accountManager.getActive()
      if (!fullAccount) throw new Error('No active account')
      const factory = new EventFactory({ signer: fullAccount })
      await saveSettings(relayPool, eventStore, factory, newSettings)
      setSettings(newSettings)
      setToastType('success')
      setToastMessage('Settings saved')
    } catch (err) {
      console.error('Failed to save settings:', err)
      setToastType('error')
      setToastMessage('Failed to save settings')
    }
  }, [relayPool, pubkey, accountManager, eventStore])

  return {
    settings,
    saveSettings: saveSettingsWithToast,
    toastMessage,
    toastType,
    clearToast: () => setToastMessage(null)
  }
}
