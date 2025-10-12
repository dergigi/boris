import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faUser, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'

interface MeProps {
  relayPool: RelayPool
}

const Me: React.FC<MeProps> = ({ relayPool }) => {
  const activeAccount = Hooks.useActiveAccount()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

  const getUserDisplayName = () => {
    if (!activeAccount) return 'Unknown User'
    if (profile?.name) return profile.name
    if (profile?.display_name) return profile.display_name
    if (profile?.nip05) return profile.nip05
    return `${activeAccount.pubkey.slice(0, 8)}...${activeAccount.pubkey.slice(-8)}`
  }

  useEffect(() => {
    const loadHighlights = async () => {
      if (!activeAccount) {
        setError('Please log in to view your highlights')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch highlights created by the user
        const userHighlights = await fetchHighlights(
          relayPool,
          activeAccount.pubkey
        )

        if (userHighlights.length === 0) {
          setError('No highlights yet. Start highlighting content to see them here!')
        }

        setHighlights(userHighlights)
      } catch (err) {
        console.error('Failed to load highlights:', err)
        setError('Failed to load highlights. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadHighlights()
  }, [relayPool, activeAccount])

  const handleHighlightDelete = (highlightId: string) => {
    // Remove highlight from local state
    setHighlights(prev => prev.filter(h => h.id !== highlightId))
  }

  if (loading) {
    return (
      <div className="explore-container">
        <div className="explore-loading">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          <p>Loading your highlights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="explore-container">
        <div className="explore-error">
          <FontAwesomeIcon icon={faExclamationCircle} size="2x" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="explore-container">
      <div className="explore-header">
        <h1>
          <FontAwesomeIcon icon={faUser} />
          {getUserDisplayName()}
        </h1>
        <p className="explore-subtitle">
          <FontAwesomeIcon icon={faHighlighter} /> {highlights.length} highlight{highlights.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="highlights-list me-highlights-list">
        {highlights.map((highlight) => (
          <HighlightItem
            key={highlight.id}
            highlight={{ ...highlight, level: 'mine' }}
            relayPool={relayPool}
            onHighlightDelete={handleHighlightDelete}
          />
        ))}
      </div>
    </div>
  )
}

export default Me

