import { useState, useEffect, useCallback } from 'react'
import { IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { EventFactory } from 'applesauce-factory'
import { AccountManager } from 'applesauce-accounts'
import { UserSettings, loadSettings, saveSettings, watchSettings } from '../services/settingsService'
import { loadFont, getFontFamily } from '../utils/fontLoader'
import { SETTINGS_RELAYS } from '../config/relays'

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
        const loadedSettings = await loadSettings(relayPool, eventStore, pubkey, SETTINGS_RELAYS)
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
    const root = document.documentElement.style
    const fontKey = settings.readingFont || 'system'
    if (fontKey !== 'system') loadFont(fontKey)
    root.setProperty('--reading-font', getFontFamily(fontKey))
    root.setProperty('--reading-font-size', `${settings.fontSize || 18}px`)
    
    // Set highlight colors for three levels
    root.setProperty('--highlight-color-mine', settings.highlightColorMine || '#ffff00')
    root.setProperty('--highlight-color-friends', settings.highlightColorFriends || '#f97316')
    root.setProperty('--highlight-color-nostrverse', settings.highlightColorNostrverse || '#9333ea')
  }, [settings])

  const saveSettingsWithToast = useCallback(async (newSettings: UserSettings) => {
    if (!relayPool || !pubkey) return
    try {
      const fullAccount = accountManager.getActive()
      if (!fullAccount) throw new Error('No active account')
      const factory = new EventFactory({ signer: fullAccount })
      await saveSettings(relayPool, eventStore, factory, newSettings, SETTINGS_RELAYS)
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
