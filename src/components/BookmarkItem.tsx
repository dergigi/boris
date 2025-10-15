import React, { useState } from 'react'
import { faNewspaper, faStickyNote, faCirclePlay, faCamera, faFileLines } from '@fortawesome/free-regular-svg-icons'
import { faGlobe, faLink } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
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
  readingProgress?: number // 0-1 reading progress (optional)
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index, onSelectUrl, viewMode = 'cards', readingProgress }) => {
  const [ogImage, setOgImage] = useState<string | null>(null)

  const short = (v: string) => `${v.slice(0, 8)}...${v.slice(-8)}`
  
  // For web bookmarks (kind:39701), URL is stored in the 'd' tag
  const isWebBookmark = bookmark.kind === 39701
  const webBookmarkUrl = isWebBookmark ? bookmark.tags.find(t => t[0] === 'd')?.[1] : null
  
  // Extract URLs from bookmark content (for regular bookmarks)
  // For web bookmarks, ensure URL has protocol
  const extractedUrls = webBookmarkUrl 
    ? [webBookmarkUrl.startsWith('http') ? webBookmarkUrl : `https://${webBookmarkUrl}`] 
    : extractUrlsFromContent(bookmark.content)
  const hasUrls = extractedUrls.length > 0
  const firstUrl = hasUrls ? extractedUrls[0] : null
  const firstUrlClassification = firstUrl ? classifyUrl(firstUrl) : null
  
  // For kind:30023 articles, extract image and summary tags (per NIP-23)
  // Note: We extract directly from tags here since we don't have the full event.
  // When we have full events, we use getArticleImage() helper (see articleService.ts)
  const isArticle = bookmark.kind === 30023
  const articleImage = isArticle ? bookmark.tags.find(t => t[0] === 'image')?.[1] : undefined
  const articleSummary = isArticle ? bookmark.tags.find(t => t[0] === 'summary')?.[1] : undefined
  
  // Fetch OG image for large view (hook must be at top level)
  const instantPreview = firstUrl ? getPreviewImage(firstUrl, firstUrlClassification?.type || '') : null
  React.useEffect(() => {
    if (viewMode === 'large' && firstUrl && !instantPreview && !ogImage && !articleImage) {
      fetchOgImage(firstUrl).then(setOgImage)
    }
  }, [viewMode, firstUrl, instantPreview, ogImage, articleImage])

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

  // Get content type icon based on bookmark kind and URL classification
  const getContentTypeIcon = (): IconDefinition => {
    if (isArticle) return faNewspaper // Nostr-native article
    
    // For web bookmarks, classify the URL to determine icon
    if (isWebBookmark && firstUrlClassification) {
      switch (firstUrlClassification.type) {
        case 'youtube':
        case 'video':
          return faCirclePlay
        case 'image':
          return faCamera
        case 'article':
          return faLink // External article
        default:
          return faGlobe
      }
    }
    
    if (!hasUrls) return faStickyNote // Just a text note
    if (firstUrlClassification?.type === 'youtube' || firstUrlClassification?.type === 'video') return faCirclePlay
    if (firstUrlClassification?.type === 'article') return faLink // External article
    return faFileLines
  }

  const getIconForUrlType = (url: string) => {
    const classification = classifyUrl(url)
    switch (classification.type) {
      case 'youtube':
      case 'video':
        return faCirclePlay
      case 'image':
        return faCamera
      default:
        return faFileLines
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
    authorNpub,
    eventNevent,
    getAuthorDisplayName,
    handleReadNow,
    articleImage,
    articleSummary,
    contentTypeIcon: getContentTypeIcon()
  }

  if (viewMode === 'compact') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const { articleImage, ...compactProps } = sharedProps
    return <CompactView {...compactProps} />
  }

  if (viewMode === 'large') {
    const previewImage = articleImage || instantPreview || ogImage
    return <LargeView {...sharedProps} getIconForUrlType={getIconForUrlType} previewImage={previewImage} readingProgress={readingProgress} />
  }

  return <CardView {...sharedProps} articleImage={articleImage} />
}
