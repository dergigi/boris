import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'

interface AddBookmarkModalProps {
  onClose: () => void
  onSave: (url: string, title?: string, description?: string, tags?: string[]) => Promise<void>
}

const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({ onClose, onSave }) => {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
            <label htmlFor="bookmark-url">URL *</label>
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

