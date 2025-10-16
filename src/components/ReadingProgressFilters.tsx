import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faCheckCircle, faAsterisk } from '@fortawesome/free-solid-svg-icons'
import { faEnvelope, faEnvelopeOpen } from '@fortawesome/free-regular-svg-icons'

export type ReadingProgressFilterType = 'all' | 'unopened' | 'started' | 'reading' | 'completed'

interface ReadingProgressFiltersProps {
  selectedFilter: ReadingProgressFilterType
  onFilterChange: (filter: ReadingProgressFilterType) => void
}

const ReadingProgressFilters: React.FC<ReadingProgressFiltersProps> = ({ selectedFilter, onFilterChange }) => {
  const filters = [
    { type: 'all' as const, icon: faAsterisk, label: 'All', color: undefined },
    { type: 'unopened' as const, icon: faEnvelope, label: 'Unopened', color: undefined },
    { type: 'started' as const, icon: faEnvelopeOpen, label: 'Started', color: 'var(--color-text)' },
    { type: 'reading' as const, icon: faBookOpen, label: 'Reading', color: '#6366f1' },
    { type: 'completed' as const, icon: faCheckCircle, label: 'Completed', color: '#10b981' }
  ]

  return (
    <div className="bookmark-filters">
      {filters.map(filter => {
        const isActive = selectedFilter === filter.type
        const activeStyle = isActive && filter.color ? { color: filter.color } : undefined
        
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

