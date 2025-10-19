import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faCheckCircle, faAsterisk, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { faEnvelope, faEnvelopeOpen } from '@fortawesome/free-regular-svg-icons'

export type ReadingProgressFilterType = 'all' | 'unopened' | 'started' | 'reading' | 'completed' | 'highlighted'

interface ReadingProgressFiltersProps {
  selectedFilter: ReadingProgressFilterType
  onFilterChange: (filter: ReadingProgressFilterType) => void
}

const ReadingProgressFilters: React.FC<ReadingProgressFiltersProps> = ({ selectedFilter, onFilterChange }) => {
  const filters = [
    { type: 'all' as const, icon: faAsterisk, label: 'All' },
    { type: 'unopened' as const, icon: faEnvelope, label: 'Unopened' },
    { type: 'started' as const, icon: faEnvelopeOpen, label: 'Started' },
    { type: 'reading' as const, icon: faBookOpen, label: 'Reading' },
    { type: 'highlighted' as const, icon: faHighlighter, label: 'Highlighted' },
    { type: 'completed' as const, icon: faCheckCircle, label: 'Completed' }
  ]

  return (
    <div className="bookmark-filters">
      {filters.map(filter => {
        const isActive = selectedFilter === filter.type
        // Only "completed" gets green color, "highlighted" gets yellow, everything else uses default blue
        let activeStyle: Record<string, string> | undefined = undefined
        if (isActive) {
          if (filter.type === 'completed') {
            activeStyle = { color: '#10b981' } // green
          } else if (filter.type === 'highlighted') {
            activeStyle = { color: '#fde047' } // yellow
          }
        }
        
        return (
          <button
            key={filter.type}
            onClick={() => onFilterChange(filter.type)}
            className={`filter-btn ${isActive ? 'active' : ''}`}
            title={filter.label}
            aria-label={`Filter by ${filter.label}`}
            style={activeStyle}
          >
            <FontAwesomeIcon icon={filter.icon} />
          </button>
        )
      })}
    </div>
  )
}

export default ReadingProgressFilters

