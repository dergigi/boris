import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
}

const ContentPanel: React.FC<ContentPanelProps> = ({ loading, title, html, markdown, selectedUrl }) => {
  if (!selectedUrl) {
    return (
      <div className="content-panel empty">
        <p>Select a bookmark to preview its content.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="content-panel loading">
        <div className="loading-spinner">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading content…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="content-panel">
      {title && <h2 className="content-title">{title}</h2>}
      {markdown ? (
        <div className="content-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </div>
      ) : html ? (
        <div className="content-html" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="content-panel empty">
          <p>No readable content found for this URL.</p>
        </div>
      )}
    </div>
  )
}

export default ContentPanel


