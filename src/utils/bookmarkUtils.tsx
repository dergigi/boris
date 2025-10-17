import React from 'react'
import { formatDistanceToNow, differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns'
import { ParsedContent, ParsedNode, IndividualBookmark } from '../types/bookmarks'
import ResolvedMention from '../components/ResolvedMention'
// Note: ContentWithResolvedProfiles is imported by components directly to keep this file component-only for fast refresh

export const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return formatDistanceToNow(date, { addSuffix: true })
}

// Ultra-compact date format for tight spaces (e.g., compact view)
export const formatDateCompact = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  
  const seconds = differenceInSeconds(now, date)
  const minutes = differenceInMinutes(now, date)
  const hours = differenceInHours(now, date)
  const days = differenceInDays(now, date)
  const months = differenceInMonths(now, date)
  const years = differenceInYears(now, date)
  
  if (seconds < 60) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 30) return `${days}d`
  if (months < 12) return `${months}mo`
  return `${years}y`
}

// Component to render content with resolved nprofile names
// Intentionally no exports except components and render helpers

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
      return <ResolvedMention key={index} encoded={node.encoded} />
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

// Sorting and grouping for bookmarks
export const sortIndividualBookmarks = (items: IndividualBookmark[]) => {
  return items
    .slice()
    .sort((a, b) => ((b.added_at || 0) - (a.added_at || 0)) || ((b.created_at || 0) - (a.created_at || 0)))
}

export function groupIndividualBookmarks(items: IndividualBookmark[]) {
  const sorted = sortIndividualBookmarks(items)
  
  // Debug: log what sourceKind values we're seeing
  const sourceKindCounts = new Map<number | undefined, number>()
  sorted.forEach(i => {
    const count = sourceKindCounts.get(i.sourceKind) || 0
    sourceKindCounts.set(i.sourceKind, count + 1)
  })
  console.log('[bookmark] 📊 SourceKind distribution:', Object.fromEntries(sourceKindCounts))
  
  // Sample a few items to see their properties
  const samples = sorted.slice(0, 5).map(i => ({
    sourceKind: i.sourceKind,
    isPrivate: i.isPrivate,
    setName: i.setName,
    id: i.id.slice(0, 20)
  }))
  console.log('[bookmark] 📊 Sample items:', samples)
  
  // Group by source list, not by content type
  const nip51Public = sorted.filter(i => i.sourceKind === 10003 && !i.isPrivate)
  const nip51Private = sorted.filter(i => i.sourceKind === 10003 && i.isPrivate)
  // Amethyst bookmarks: kind:30001 with d-tag "bookmark"
  const amethystPublic = sorted.filter(i => i.sourceKind === 30001 && !i.isPrivate && i.setName === 'bookmark')
  const amethystPrivate = sorted.filter(i => i.sourceKind === 30001 && i.isPrivate && i.setName === 'bookmark')
  const standaloneWeb = sorted.filter(i => i.sourceKind === 39701)
  
  console.log('[bookmark] 📊 After grouping:', {
    nip51Public: nip51Public.length,
    nip51Private: nip51Private.length,
    amethystPublic: amethystPublic.length,
    amethystPrivate: amethystPrivate.length,
    standaloneWeb: standaloneWeb.length,
    total: sorted.length
  })
  
  return { 
    nip51Public, 
    nip51Private, 
    amethystPublic, 
    amethystPrivate,
    standaloneWeb
  }
}

// Simple filter: show bookmarks that have content OR just an ID (placeholder)
export function hasContent(bookmark: IndividualBookmark): boolean {
  // Show if has content OR has an ID (placeholder until events are fetched)
  const hasValidContent = !!(bookmark.content && bookmark.content.trim().length > 0)
  const hasId = !!(bookmark.id && bookmark.id.trim().length > 0)
  return hasValidContent || hasId
}

// Bookmark sets helpers (kind 30003)
export interface BookmarkSet {
  name: string
  title?: string
  description?: string
  image?: string
  bookmarks: IndividualBookmark[]
}

export function getBookmarkSets(items: IndividualBookmark[]): BookmarkSet[] {
  // Group bookmarks by setName
  const setMap = new Map<string, IndividualBookmark[]>()
  
  items.forEach(bookmark => {
    if (bookmark.setName) {
      const existing = setMap.get(bookmark.setName) || []
      existing.push(bookmark)
      setMap.set(bookmark.setName, existing)
    }
  })
  
  // Convert to array and extract metadata from the bookmarks
  const sets: BookmarkSet[] = []
  setMap.forEach((bookmarks, name) => {
    // Get metadata from the first bookmark (all bookmarks in a set share the same metadata)
    const firstBookmark = bookmarks[0]
    const title = firstBookmark?.setTitle
    const description = firstBookmark?.setDescription
    const image = firstBookmark?.setImage
    
    sets.push({
      name,
      title,
      description,
      image,
      bookmarks: sortIndividualBookmarks(bookmarks)
    })
  })
  
  return sets.sort((a, b) => a.name.localeCompare(b.name))
}

export function getBookmarksWithoutSet(items: IndividualBookmark[]): IndividualBookmark[] {
  return sortIndividualBookmarks(items.filter(b => !b.setName))
}
