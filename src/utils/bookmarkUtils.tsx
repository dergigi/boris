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
  const amethyst = sorted.filter(i => i.sourceKind === 30001)
  const web = sorted.filter(i => i.kind === 39701 || i.type === 'web')
  const isIn = (list: IndividualBookmark[], x: IndividualBookmark) => list.some(i => i.id === x.id)
  const privateItems = sorted.filter(i => i.isPrivate && !isIn(amethyst, i) && !isIn(web, i))
  const publicItems = sorted.filter(i => !i.isPrivate && !isIn(amethyst, i) && !isIn(web, i))
  return { privateItems, publicItems, web, amethyst }
}

// Simple filter: only exclude bookmarks with empty/whitespace-only content
export function hasContent(bookmark: IndividualBookmark): boolean {
  return !!(bookmark.content && bookmark.content.trim().length > 0)
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
