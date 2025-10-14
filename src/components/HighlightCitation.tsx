import React, { useState, useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { fetchArticleTitle } from '../services/articleTitleResolver'

interface HighlightCitationProps {
  eventReference?: string
  urlReference?: string
  authorPubkey?: string
  relayPool?: RelayPool | null
}

export const HighlightCitation: React.FC<HighlightCitationProps> = ({
  eventReference,
  urlReference,
  authorPubkey,
  relayPool
}) => {
  const [articleTitle, setArticleTitle] = useState<string>()
  const authorProfile = useEventModel(Models.ProfileModel, authorPubkey ? [authorPubkey] : null)
  
  // Debug: log the authorPubkey and profile
  useEffect(() => {
    if (authorPubkey) {
      console.log('📝 HighlightCitation - authorPubkey:', authorPubkey)
      console.log('📝 HighlightCitation - authorProfile:', authorProfile)
    }
  }, [authorPubkey, authorProfile])
  
  useEffect(() => {
    if (!eventReference || !relayPool) {
      return
    }
    
    const loadTitle = async () => {
      try {
        // Convert eventReference to naddr if needed
        let naddr: string
        if (eventReference.includes(':')) {
          const parts = eventReference.split(':')
          const kind = parseInt(parts[0])
          const pubkey = parts[1]
          const identifier = parts[2] || ''
          
          naddr = nip19.naddrEncode({
            kind,
            pubkey,
            identifier
          })
        } else {
          naddr = eventReference
        }
        
        const title = await fetchArticleTitle(relayPool, naddr)
        if (title) {
          setArticleTitle(title)
        }
      } catch (error) {
        console.error('Failed to load article title:', error)
      }
    }
    
    loadTitle()
  }, [eventReference, relayPool])
  
  const authorName = authorProfile?.name || authorProfile?.display_name
  
  // For nostr-native content with article reference
  if (eventReference && (authorName || articleTitle)) {
    return (
      <div className="highlight-citation">
        — {authorName || 'Unknown'}{articleTitle ? `, ${articleTitle}` : ''}
      </div>
    )
  }
  
  // For web URLs
  if (urlReference) {
    try {
      const url = new URL(urlReference)
      return (
        <div className="highlight-citation">
          — {url.hostname}
        </div>
      )
    } catch {
      return null
    }
  }
  
  return null
}

