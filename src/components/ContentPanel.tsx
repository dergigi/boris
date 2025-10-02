import React from 'react'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  selectedUrl?: string
}

const ContentPanel: React.FC<ContentPanelProps> = ({ loading, title, html, selectedUrl }) => {
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
        <p>Loading content…</p>
      </div>
    )
  }

  return (
    <div className="content-panel">
      {title && <h2 className="content-title">{title}</h2>}
      {html ? (
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


