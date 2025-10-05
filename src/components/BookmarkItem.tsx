import React, { useState } from 'react'
import { faBookOpen, faPlay, faEye } from '@fortawesome/free-solid-svg-icons'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { npubEncode, neventEncode } from 'nostr-tools/nip19'
import { IndividualBookmark } from '../types/bookmarks'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'
import { classifyUrl } from '../utils/helpers'
import { ViewMode } from './Bookmarks'
import { getPreviewImage, fetchOgImage } from '../utils/imagePreview'
import { CompactView } from './BookmarkViews/CompactView'
import { LargeView } from './BookmarkViews/LargeView'
import { CardView } from './BookmarkViews/CardView'

interface BookmarkItemProps {
  bookmark: IndividualBookmark
  index: number
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  viewMode?: ViewMode
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index, onSelectUrl, viewMode = 'cards' }) => {
  const [ogImage, setOgImage] = useState<string | null>(null)

  const short = (v: string) => `${v.slice(0, 8)}...${v.slice(-8)}`
  
  // Extract URLs from bookmark content
  const extractedUrls = extractUrlsFromContent(bookmark.content)
  const hasUrls = extractedUrls.length > 0
  const firstUrl = hasUrls ? extractedUrls[0] : null
  const firstUrlClassification = firstUrl ? classifyUrl(firstUrl) : null
  
  // Fetch OG image for large view (hook must be at top level)
  const instantPreview = firstUrl ? getPreviewImage(firstUrl, firstUrlClassification?.type || '') : null
  React.useEffect(() => {
    if (viewMode === 'large' && firstUrl && !instantPreview && !ogImage) {
      fetchOgImage(firstUrl).then(setOgImage)
    }
  }, [viewMode, firstUrl, instantPreview, ogImage])

  // Resolve author profile using applesauce
  const authorProfile = useEventModel(Models.ProfileModel, [bookmark.pubkey])
  const authorNpub = npubEncode(bookmark.pubkey)
  const isHexId = /^[0-9a-f]{64}$/i.test(bookmark.id)
  const eventNevent = isHexId ? neventEncode({ id: bookmark.id }) : undefined
  
  // Get display name for author
  const getAuthorDisplayName = () => {
    if (authorProfile?.name) return authorProfile.name
    if (authorProfile?.display_name) return authorProfile.display_name
    if (authorProfile?.nip05) return authorProfile.nip05
    return short(bookmark.pubkey) // fallback to short pubkey
  }

  // use helper from kindIcon.ts

  const getIconForUrlType = (url: string) => {
    const classification = classifyUrl(url)
    switch (classification.type) {
      case 'youtube':
      case 'video':
        return faPlay
      case 'image':
        return faEye
      default:
        return faBookOpen
    }
  }

  const handleReadNow = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    
    // For kind:30023 articles, pass the bookmark data instead of URL
    if (bookmark.kind === 30023) {
      if (onSelectUrl) {
        onSelectUrl('', { id: bookmark.id, kind: bookmark.kind, tags: bookmark.tags, pubkey: bookmark.pubkey })
      }
      return
    }
    
    // For regular bookmarks with URLs
    if (!hasUrls) return
    const firstUrl = extractedUrls[0]
    if (onSelectUrl) {
      onSelectUrl(firstUrl)
    } else {
      window.open(firstUrl, '_blank')
    }
  }

  const sharedProps = {
    bookmark,
    index,
    hasUrls,
    extractedUrls,
    onSelectUrl,
    getIconForUrlType,
    firstUrlClassification,
    authorNpub,
    eventNevent,
    getAuthorDisplayName,
    handleReadNow
  }

  if (viewMode === 'compact') {
    return <CompactView {...sharedProps} />
  }

  if (viewMode === 'large') {
    const previewImage = instantPreview || ogImage
    return <LargeView {...sharedProps} previewImage={previewImage} />
  }

  return <CardView {...sharedProps} />
}
