import React, { useState, useEffect, useMemo } from 'react'
import { RelayPool } from 'applesauce-relay'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { fetchArticleTitle } from '../services/articleTitleResolver'
import { Highlight } from '../types/highlights'

interface HighlightCitationProps {
  highlight: Highlight
  relayPool?: RelayPool | null
}

export const HighlightCitation: React.FC<HighlightCitationProps> = ({
  highlight,
  relayPool
}) => {
  const [articleTitle, setArticleTitle] = useState<string>()
  
  // Extract author pubkey from p tag directly
  const authorPubkey = useMemo(() => {
    // First try the extracted author from highlight.author
    if (highlight.author) {
      return highlight.author
    }
    
    // Fallback: extract directly from p tag
    const pTag = highlight.tags.find(t => t[0] === 'p')
    if (pTag && pTag[1]) {
      console.log('📝 Found author from p tag:', pTag[1])
      return pTag[1]
    }
    
    return undefined
  }, [highlight.author, highlight.tags])
  
  const authorProfile = useEventModel(Models.ProfileModel, authorPubkey ? [authorPubkey] : null)
  
  useEffect(() => {
    if (!highlight.eventReference || !relayPool) {
      return
    }
    
    const loadTitle = async () => {
      try {
        if (!highlight.eventReference) return
        
        // Convert eventReference to naddr if needed
        let naddr: string
        if (highlight.eventReference.includes(':')) {
          const parts = highlight.eventReference.split(':')
          const kind = parseInt(parts[0])
          const pubkey = parts[1]
          const identifier = parts[2] || ''
          
          naddr = nip19.naddrEncode({
            kind,
            pubkey,
            identifier
          })
        } else {
          naddr = highlight.eventReference
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
  }, [highlight.eventReference, relayPool])
  
  const authorName = authorProfile?.name || authorProfile?.display_name
  
  // For nostr-native content with article reference
  if (highlight.eventReference && (authorName || articleTitle)) {
    return (
      <div className="highlight-citation">
        — {authorName || 'Unknown'}{articleTitle ? `, ${articleTitle}` : ''}
      </div>
    )
  }
  
  // For web URLs
  if (highlight.urlReference) {
    try {
      const url = new URL(highlight.urlReference)
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

