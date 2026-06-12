import { useState, useCallback, useEffect } from 'react'
import { UserSettings } from '../services/settingsService'
import { HighlightVisibility } from '../components/HighlightsPanel'

export const useExploreVisibility = (
  activeAccount: { pubkey: string } | undefined,
  settings: UserSettings | undefined
) => {
  // Visibility filters - load from localStorage first, fallback to settings
  const [visibility, setVisibility] = useState<HighlightVisibility>(() => {
    // Try to load from localStorage first
    try {
      const saved = localStorage.getItem('exploreScopeVisibility')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate all required properties are booleans
        if (
          typeof parsed.nostrverse === 'boolean' &&
          typeof parsed.friends === 'boolean' &&
          typeof parsed.mine === 'boolean' &&
          (parsed.nostrverse || parsed.friends || parsed.mine)
        ) {
          return parsed
        }
      }
    } catch (err) {
      console.warn('Failed to load explore scope from localStorage:', err)
    }
    
    // Fallback to settings or defaults
    return {
      nostrverse: activeAccount ? (settings?.defaultExploreScopeNostrverse ?? false) : true,
      friends: settings?.defaultExploreScopeFriends ?? true,
      mine: settings?.defaultExploreScopeMine ?? false
    }
  })

  // Ensure at least one scope remains active
  const toggleScope = useCallback((key: 'nostrverse' | 'friends' | 'mine') => {
    setVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (!next.nostrverse && !next.friends && !next.mine) {
        return prev // ignore toggle that would disable all scopes
      }
      // Persist to localStorage
      try {
        localStorage.setItem('exploreScopeVisibility', JSON.stringify(next))
      } catch (err) {
        console.warn('Failed to save explore scope to localStorage:', err)
      }
      return next
    })
  }, [])

  // Update visibility when settings/login state changes
  useEffect(() => {
    // Check if user has a saved preference
    const hasSavedPreference = (() => {
      try {
        return localStorage.getItem('exploreScopeVisibility') !== null
      } catch {
        return false
      }
    })()
    
    // Only reset to defaults if no saved preference exists
    if (hasSavedPreference) {
      return
    }
    
    if (!activeAccount) {
      // When logged out, show nostrverse by default
      const defaultVisibility = { nostrverse: true, friends: false, mine: false }
      setVisibility(defaultVisibility)
      try {
        localStorage.setItem('exploreScopeVisibility', JSON.stringify(defaultVisibility))
      } catch (err) {
        console.warn('Failed to save explore scope to localStorage:', err)
      }
    } else {
      // When logged in, use settings defaults immediately
      const defaultVisibility = {
        nostrverse: settings?.defaultExploreScopeNostrverse ?? false,
        friends: settings?.defaultExploreScopeFriends ?? true,
        mine: settings?.defaultExploreScopeMine ?? false
      }
      setVisibility(defaultVisibility)
      try {
        localStorage.setItem('exploreScopeVisibility', JSON.stringify(defaultVisibility))
      } catch (err) {
        console.warn('Failed to save explore scope to localStorage:', err)
      }
    }
  }, [activeAccount, settings?.defaultExploreScopeNostrverse, settings?.defaultExploreScopeFriends, settings?.defaultExploreScopeMine])

  return { visibility, toggleScope }
}
