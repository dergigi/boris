import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { faNewspaper, faStickyNote, faCirclePlay, faCamera, faFileLines } from '@fortawesome/free-regular-svg-icons'
import { faGlobe, faLink } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { npubEncode, naddrEncode } from 'nostr-tools/nip19'
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
  readingProgress?: number
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index, onSelectUrl, viewMode = 'cards', readingProgress }) => {
  const navigate = useNavigate()
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
  
  // For kind:30023 articles, extract title, image and summary tags (per NIP-23)
  // Note: We extract directly from tags here since we don't have the full event.
  // When we have full events, we use getArticleImage() helper (see articleService.ts)
  const isArticle = bookmark.kind === 30023
  const articleTitle = isArticle ? bookmark.tags.find(t => t[0] === 'title')?.[1] : undefined
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
    
    // For kind:30023 articles, navigate to /a/:naddr route
    if (bookmark.kind === 30023) {
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1]
      if (dTag) {
        const naddr = naddrEncode({
          kind: bookmark.kind,
          pubkey: bookmark.pubkey,
          identifier: dTag
        })
        navigate(`/a/${naddr}`)
      }
      return
    }
    
    // For regular bookmarks with URLs
    if (!hasUrls) return
    const firstUrl = extractedUrls[0]
    if (onSelectUrl) {
      onSelectUrl(firstUrl, bookmark)
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
    getAuthorDisplayName,
    handleReadNow,
    articleImage,
    articleSummary,
    contentTypeIcon: getContentTypeIcon(),
    readingProgress
  }

  if (viewMode === 'compact') {
    const compactProps = {
      bookmark,
      index,
      hasUrls,
      extractedUrls,
      onSelectUrl,
      articleTitle,
      contentTypeIcon: getContentTypeIcon(),
      readingProgress
    }
    return <CompactView {...compactProps} />
  }

  if (viewMode === 'large') {
    const previewImage = articleImage || instantPreview || ogImage
    return <LargeView {...sharedProps} getIconForUrlType={getIconForUrlType} previewImage={previewImage} />
  }

  return <CardView {...sharedProps} articleImage={articleImage} />
}
