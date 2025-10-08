import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import { fetchReadableContent } from '../services/readerService'

interface AddBookmarkModalProps {
  onClose: () => void
  onSave: (url: string, title?: string, description?: string, tags?: string[]) => Promise<void>
}

const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({ onClose, onSave }) => {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('boris')
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
        const metadata = await fetchReadableContent(normalizedUrl)
        lastFetchedUrlRef.current = normalizedUrl
        
        // Extract title: prioritize og:title, then regular title
        let extractedTitle = ''
        if (metadata.html) {
          // Try OpenGraph title first
          const ogTitleMatch = metadata.html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
          if (ogTitleMatch) {
            extractedTitle = ogTitleMatch[1]
          } else {
            // Fallback to twitter:title
            const twitterTitleMatch = metadata.html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i)
            if (twitterTitleMatch) {
              extractedTitle = twitterTitleMatch[1]
            }
          }
        }
        
        // Use metadata.title as last resort
        if (!extractedTitle && metadata.title) {
          extractedTitle = metadata.title
        }
        
        // Only auto-fill if field is empty
        if (extractedTitle && !title) {
          setTitle(extractedTitle)
        }
        
        // Extract description: prioritize og:description
        if (!description) {
          let extractedDesc = ''
          
          if (metadata.html) {
            // Try OpenGraph description first
            const ogDescMatch = metadata.html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
            if (ogDescMatch) {
              extractedDesc = ogDescMatch[1]
            } else {
              // Try twitter:description
              const twitterDescMatch = metadata.html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i)
              if (twitterDescMatch) {
                extractedDesc = twitterDescMatch[1]
              } else {
                // Fallback to standard meta description
                const metaDescMatch = metadata.html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
                if (metaDescMatch) {
                  extractedDesc = metaDescMatch[1]
                } else {
                  // Last resort: extract from first <p> tag
                  const pMatch = metadata.html.match(/<p[^>]*>(.*?)<\/p>/is)
                  if (pMatch) {
                    extractedDesc = pMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 200)
                  }
                }
              }
            }
          } else if (metadata.markdown) {
            // For markdown, take first paragraph
            const firstPara = metadata.markdown.split('\n\n')[0]
            extractedDesc = firstPara.replace(/^#+\s*/g, '').trim().slice(0, 200)
          }
          
          if (extractedDesc) {
            setDescription(extractedDesc)
          }
        }
        
        // Extract tags: check keywords meta and OpenGraph article tags
        if (metadata.html && tagsInput === 'boris') {
          const extractedTags: string[] = []
          
          // Try keywords meta tag
          const keywordsMatch = metadata.html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i)
          if (keywordsMatch) {
            const keywords = keywordsMatch[1]
              .split(/[,;]/)
              .map(k => k.trim().toLowerCase())
              .filter(k => k.length > 0 && k.length < 30) // Reasonable tag length
            extractedTags.push(...keywords)
          }
          
          // Try OpenGraph article:tag
          const articleTagRegex = /<meta\s+property=["']article:tag["']\s+content=["']([^"']+)["']/gi
          let match
          while ((match = articleTagRegex.exec(metadata.html)) !== null) {
            const tag = match[1].trim().toLowerCase()
            if (tag && tag.length < 30) {
              extractedTags.push(tag)
            }
          }
          
          // Deduplicate and limit to first 5 tags
          const uniqueTags = Array.from(new Set(extractedTags)).slice(0, 5)
          
          if (uniqueTags.length > 0) {
            // Prepend boris to extracted tags
            setTagsInput('boris, ' + uniqueTags.join(', '))
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
  }, [url]) // Only depend on url

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

  return (
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
    </div>
  )
}

export default AddBookmarkModal

