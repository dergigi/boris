import React from 'react'
import { ParsedContent, ParsedNode } from '../types/bookmarks'
import { decode } from 'nostr-tools/nip19'
import { getPubkeyFromDecodeResult } from 'applesauce-core/helpers'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'

export const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString()
}

// Extract pubkeys from nprofile strings in content
export const extractNprofilePubkeys = (content: string): string[] => {
  const nprofileRegex = /nprofile1[a-z0-9]+/gi
  const matches = content.match(nprofileRegex) || []
  const pubkeys: string[] = []
  
  for (const match of matches) {
    try {
      const decoded = decode(match)
      const pubkey = getPubkeyFromDecodeResult(decoded)
      if (pubkey && !pubkeys.includes(pubkey)) {
        pubkeys.push(pubkey)
      }
    } catch (error) {
      // Invalid nprofile string, skip
      console.warn('Failed to decode nprofile:', match, error)
    }
  }
  
  return pubkeys
}

// Component to render content with resolved nprofile names
export const ContentWithResolvedProfiles: React.FC<{ content: string }> = ({ content }) => {
  const nprofilePubkeys = extractNprofilePubkeys(content)
  
  // Create individual profile hooks for each pubkey
  const profiles = nprofilePubkeys.map(pubkey => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const profile = useEventModel(Models.ProfileModel, [pubkey])
    return { pubkey, profile }
  })
  
  // Replace nprofile strings with resolved names
  const renderContent = () => {
    let renderedContent = content
    
    profiles.forEach(({ pubkey, profile }) => {
      const displayName = profile?.name || profile?.display_name || profile?.nip05 || `${pubkey.slice(0, 8)}...`
      
      // Replace all instances of this nprofile with the display name
      const nprofileRegex = new RegExp(`nprofile1[a-z0-9]+`, 'gi')
      const matches = content.match(nprofileRegex) || []
      
      matches.forEach(match => {
        try {
          const decoded = decode(match)
          const matchPubkey = getPubkeyFromDecodeResult(decoded)
          if (matchPubkey === pubkey) {
            renderedContent = renderedContent.replace(match, `@${displayName}`)
          }
        } catch (error) {
          // Skip invalid nprofile
        }
      })
    })
    
    return renderedContent
  }
  
  return <div className="bookmark-content">{renderContent()}</div>
}

// Component to render parsed content using applesauce-content
export const renderParsedContent = (parsedContent: ParsedContent) => {
  if (!parsedContent || !parsedContent.children) {
    return null
  }

  const renderNode = (node: ParsedNode, index: number): React.ReactNode => {
    if (node.type === 'text') {
      return <span key={index}>{node.value}</span>
    }
    
    if (node.type === 'mention') {
      return (
        <a 
          key={index}
          href={`nostr:${node.encoded}`}
          className="nostr-mention"
          target="_blank"
          rel="noopener noreferrer"
        >
          {node.encoded}
        </a>
      )
    }
    
    if (node.type === 'link') {
      return (
        <a 
          key={index}
          href={node.url}
          className="nostr-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {node.url}
        </a>
      )
    }
    
    if (node.children) {
      return (
        <span key={index}>
          {node.children.map((child: ParsedNode, childIndex: number) => 
            renderNode(child, childIndex)
          )}
        </span>
      )
    }
    
    return null
  }

  return (
    <div className="parsed-content">
      {parsedContent.children.map((node: ParsedNode, index: number) => 
        renderNode(node, index)
      )}
    </div>
  )
}
