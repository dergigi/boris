import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import urlMetadata from 'url-metadata'

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
        const metadata = await urlMetadata(normalizedUrl)
        lastFetchedUrlRef.current = normalizedUrl
        
        // Extract title: prioritize og:title > twitter:title > title
        const extractedTitle = metadata['og:title'] || metadata['twitter:title'] || metadata.title
        if (extractedTitle && !title) {
          setTitle(extractedTitle as string)
        }
        
        // Extract description: prioritize og:description > twitter:description > description
        if (!description) {
          const extractedDesc = metadata['og:description'] || metadata['twitter:description'] || metadata.description
          if (extractedDesc) {
            setDescription(extractedDesc as string)
          }
        }
        
        // Extract tags from keywords and article:tag
        if (tagsInput === 'boris') {
          const normalizeTags = (value: string | string[], delimiter = /[,;]/) => {
            const arr = Array.isArray(value) ? value : value.split(delimiter)
            return arr
              .map(t => t.trim().toLowerCase())
              .filter(t => t.length > 0 && t.length < 30)
          }
          
          const extractedTags = [
            ...(metadata.keywords ? normalizeTags(metadata.keywords) : []),
            ...(metadata['article:tag'] ? normalizeTags(metadata['article:tag']) : [])
          ]
          
          const uniqueTags = Array.from(new Set(extractedTags)).slice(0, 5)
          if (uniqueTags.length > 0) {
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

