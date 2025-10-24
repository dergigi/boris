import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import { fetchReadableContent } from '../services/readerService'
import { fetch } from 'fetch-opengraph'

interface AddBookmarkModalProps {
  onClose: () => void
  onSave: (url: string, title?: string, description?: string, tags?: string[]) => Promise<void>
}

// Helper to extract tags from OpenGraph data
function extractTagsFromOgData(ogData: any): string[] {
  const tags: string[] = []
  
  // Extract keywords from OpenGraph data
  if (ogData.keywords) {
    ogData.keywords.split(/[,;]/)
      .map((k: string) => k.trim().toLowerCase())
      .filter((k: string) => k.length > 0 && k.length < 30)
      .forEach((k: string) => tags.push(k))
  }
  
  // Extract article:tag from OpenGraph data
  if (ogData['article:tag']) {
    const articleTags = Array.isArray(ogData['article:tag']) 
      ? ogData['article:tag'] 
      : [ogData['article:tag']]
    
    articleTags.forEach((tag: string) => {
      const cleanTag = tag.trim().toLowerCase()
      if (cleanTag && cleanTag.length < 30) {
        tags.push(cleanTag)
      }
    })
  }
  
  return Array.from(new Set(tags)).slice(0, 5)
}

const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({ onClose, onSave }) => {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchTimeoutRef = useRef<number | null>(null)
  const lastFetchedUrlRef = useRef<string>('')

  // Fetch metadata when URL changes
  useEffect(() => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    // Don't fetch if URL is empty or invalid
    if (!url.trim()) return

    // Validate URL format first
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim())
    } catch {
      return // Invalid URL, don't fetch
    }

    // Skip if we've already fetched this URL
    const normalizedUrl = parsedUrl.toString()
    if (lastFetchedUrlRef.current === normalizedUrl) {
      return
    }

    // Debounce the fetch to avoid spamming the API
    fetchTimeoutRef.current = window.setTimeout(async () => {
      setIsFetchingMetadata(true)
      try {
        // Fetch both readable content and OpenGraph data in parallel
        const [content, ogData] = await Promise.all([
          fetchReadableContent(normalizedUrl),
          fetch(normalizedUrl).catch(() => null) // Don't fail if OpenGraph fetch fails
        ])
        
        lastFetchedUrlRef.current = normalizedUrl
        let extractedAnything = false
        
        // Extract title: prioritize og:title > twitter:title > content.title
        if (!title) {
          let extractedTitle = null
          
          if (ogData) {
            extractedTitle = ogData['og:title'] || ogData['twitter:title'] || ogData.title
          }
          
          // Fallback to content.title if no OpenGraph title found
          if (!extractedTitle) {
            extractedTitle = content.title
          }
          
          if (extractedTitle) {
            setTitle(extractedTitle)
            extractedAnything = true
          }
        }
        
        // Extract description: prioritize og:description > twitter:description > meta description
        if (!description && ogData) {
          const extractedDesc = ogData['og:description'] || ogData['twitter:description'] || ogData.description
          
          if (extractedDesc) {
            setDescription(extractedDesc)
            extractedAnything = true
          }
        }
        
        // Extract tags from keywords and article:tag (only if user hasn't modified tags)
        if (!tagsInput && ogData) {
          const extractedTags = extractTagsFromOgData(ogData)
          
          // Only add boris tag if we extracted something
          if (extractedAnything || extractedTags.length > 0) {
            const allTags = extractedTags.length > 0 
              ? ['boris', ...extractedTags] 
              : ['boris']
            setTagsInput(allTags.join(', '))
          }
        }
      } catch (err) {
        console.warn('Failed to fetch metadata:', err)
        // Don't show error to user, just skip auto-fill
      } finally {
        setIsFetchingMetadata(false)
      }
    }, 800) // Wait 800ms after user stops typing

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [url, title, description, tagsInput])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!url.trim()) {
      setError('URL is required')
      return
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    try {
      setIsSaving(true)
      
      // Parse tags from comma-separated input
      const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
      
      await onSave(
        url.trim(),
        title.trim() || undefined,
        description.trim() || undefined,
        tags.length > 0 ? tags : undefined
      )
      onClose()
    } catch (err) {
      console.error('Failed to save bookmark:', err)
      setError(err instanceof Error ? err.message : 'Failed to save bookmark')
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Bookmark</h2>
          <IconButton
            icon={faTimes}
            onClick={onClose}
            title="Close"
            ariaLabel="Close modal"
            variant="ghost"
          />
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="bookmark-url">
              URL *
              {isFetchingMetadata && (
                <span className="fetching-indicator">
                  <FontAwesomeIcon icon={faSpinner} spin /> Fetching details...
                </span>
              )}
            </label>
            <input
              id="bookmark-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="bookmark-title">Title</label>
            <input
              id="bookmark-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bookmark-description">Description</label>
            <textarea
              id="bookmark-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={isSaving}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bookmark-tags">Tags</label>
            <input
              id="bookmark-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="comma, separated, tags"
              disabled={isSaving}
            />
            <div className="form-helper-text">
              Separate tags with commas (e.g., "nostr, web3, article")
            </div>
          </div>

          {error && (
            <div className="modal-error">{error}</div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Bookmark'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default AddBookmarkModal

