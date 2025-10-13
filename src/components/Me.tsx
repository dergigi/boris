import React, { useState, useEffect, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faUser, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'
import ArticleSourceCard from './ArticleSourceCard'

interface MeProps {
  relayPool: RelayPool
}

const Me: React.FC<MeProps> = ({ relayPool }) => {
  const activeAccount = Hooks.useActiveAccount()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

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

  // Group highlights by their URL reference
  const groupedHighlights = useMemo(() => {
    const grouped = new Map<string, Highlight[]>()
    
    highlights.forEach(highlight => {
      const url = highlight.urlReference || 'unknown'
      if (!grouped.has(url)) {
        grouped.set(url, [])
      }
      grouped.get(url)!.push(highlight)
    })
    
    // Sort by number of highlights (descending)
    return Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
  }, [highlights])

  // Auto-select first article if nothing is selected
  useEffect(() => {
    if (!selectedUrl && groupedHighlights.length > 0) {
      setSelectedUrl(groupedHighlights[0][0])
    }
  }, [groupedHighlights, selectedUrl])

  // Get highlights for selected article
  const selectedHighlights = useMemo(() => {
    if (!selectedUrl) return []
    return highlights.filter(h => (h.urlReference || 'unknown') === selectedUrl)
  }, [highlights, selectedUrl])

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
    <div className="me-container">
      <div className="me-header">
        <h1>
          <FontAwesomeIcon icon={faUser} />
          {getUserDisplayName()}
        </h1>
        <p className="me-subtitle">
          <FontAwesomeIcon icon={faHighlighter} /> {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} 
          {' '}&bull;{' '} {groupedHighlights.length} source{groupedHighlights.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="me-two-pane">
        <div className="me-sources-pane">
          <h2 className="me-pane-title">Sources</h2>
          <div className="me-sources-list">
            {groupedHighlights.map(([url, hlts]) => (
              <ArticleSourceCard
                key={url}
                url={url}
                highlightCount={hlts.length}
                isSelected={selectedUrl === url}
                onClick={() => setSelectedUrl(url)}
              />
            ))}
          </div>
        </div>
        <div className="me-highlights-pane">
          <h2 className="me-pane-title">
            Highlights
            {selectedHighlights.length > 0 && (
              <span className="me-pane-count"> ({selectedHighlights.length})</span>
            )}
          </h2>
          <div className="me-highlights-list">
            {selectedHighlights.length > 0 ? (
              selectedHighlights.map((highlight) => (
                <HighlightItem
                  key={highlight.id}
                  highlight={{ ...highlight, level: 'mine' }}
                  relayPool={relayPool}
                  onHighlightDelete={handleHighlightDelete}
                />
              ))
            ) : (
              <div className="me-empty-state">
                <FontAwesomeIcon icon={faHighlighter} size="2x" />
                <p>Select a source to view highlights</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Me

