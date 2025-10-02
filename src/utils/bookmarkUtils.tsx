import React from 'react'
import { ParsedContent, ParsedNode } from '../types/bookmarks'
import { ContentWithResolvedProfiles } from '../components/ContentWithResolvedProfiles'

export const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString()
}

// Component to render content with resolved nprofile names
export { default as ContentWithResolvedProfiles } from '../components/ContentWithResolvedProfiles'

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
