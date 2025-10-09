import { useState, useEffect, useCallback } from 'react'
import { IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { EventFactory } from 'applesauce-factory'
import { AccountManager } from 'applesauce-accounts'
import { UserSettings, loadSettings, saveSettings, watchSettings } from '../services/settingsService'
import { loadFont, getFontFamily } from '../utils/fontLoader'
import { RELAYS } from '../config/relays'

interface UseSettingsParams {
  relayPool: RelayPool | null
  eventStore: IEventStore
  pubkey: string | undefined
  accountManager: AccountManager
}

export function useSettings({ relayPool, eventStore, pubkey, accountManager }: UseSettingsParams) {
  const [settings, setSettings] = useState<UserSettings>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // Load settings and set up subscription
  useEffect(() => {
    if (!relayPool || !pubkey || !eventStore) return

    const loadAndWatch = async () => {
      try {
        const loadedSettings = await loadSettings(relayPool, eventStore, pubkey, RELAYS)
        if (loadedSettings) setSettings(loadedSettings)
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }

    loadAndWatch()

    const subscription = watchSettings(eventStore, pubkey, (loadedSettings) => {
      if (loadedSettings) setSettings(loadedSettings)
    })

    return () => subscription.unsubscribe()
  }, [relayPool, pubkey, eventStore])

  // Apply settings to document
  useEffect(() => {
    const applyStyles = async () => {
      const root = document.documentElement.style
      const fontKey = settings.readingFont || 'system'
      
      console.log('🎨 Applying settings styles:', { fontKey, fontSize: settings.fontSize })
      
      // Load font first and wait for it to be ready
      if (fontKey !== 'system') {
        console.log('⏳ Waiting for font to load...')
        await loadFont(fontKey)
        console.log('✅ Font loaded, applying styles')
      }
      
      // Apply font settings after font is loaded
      root.setProperty('--reading-font', getFontFamily(fontKey))
      root.setProperty('--reading-font-size', `${settings.fontSize || 21}px`)
      
      // Set highlight colors for three levels
      root.setProperty('--highlight-color-mine', settings.highlightColorMine || '#ffff00')
      root.setProperty('--highlight-color-friends', settings.highlightColorFriends || '#f97316')
      root.setProperty('--highlight-color-nostrverse', settings.highlightColorNostrverse || '#9333ea')
      
      console.log('✅ All styles applied')
    }
    
    applyStyles()
  }, [settings])

  const saveSettingsWithToast = useCallback(async (newSettings: UserSettings) => {
    if (!relayPool || !pubkey) return
    try {
      const fullAccount = accountManager.getActive()
      if (!fullAccount) throw new Error('No active account')
      const factory = new EventFactory({ signer: fullAccount })
      await saveSettings(relayPool, eventStore, factory, newSettings, RELAYS)
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
