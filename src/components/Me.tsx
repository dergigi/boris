import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'
import AuthorCard from './AuthorCard'

interface MeProps {
  relayPool: RelayPool
}

const Me: React.FC<MeProps> = ({ relayPool }) => {
  const activeAccount = Hooks.useActiveAccount()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        {activeAccount && <AuthorCard authorPubkey={activeAccount.pubkey} />}
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

