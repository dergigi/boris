import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faCheckCircle, faAsterisk } from '@fortawesome/free-solid-svg-icons'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'

export type ReadingProgressFilterType = 'all' | 'to-read' | 'reading' | 'completed'

interface ReadingProgressFiltersProps {
  selectedFilter: ReadingProgressFilterType
  onFilterChange: (filter: ReadingProgressFilterType) => void
}

const ReadingProgressFilters: React.FC<ReadingProgressFiltersProps> = ({ selectedFilter, onFilterChange }) => {
  const filters = [
    { type: 'all' as const, icon: faAsterisk, label: 'All' },
    { type: 'to-read' as const, icon: faBookmark, label: 'To Read' },
    { type: 'reading' as const, icon: faBookOpen, label: 'Reading' },
    { type: 'completed' as const, icon: faCheckCircle, label: 'Completed' }
  ]

  return (
    <div className="bookmark-filters">
      {filters.map(filter => (
        <button
          key={filter.type}
          onClick={() => onFilterChange(filter.type)}
          className={`filter-btn ${selectedFilter === filter.type ? 'active' : ''}`}
          title={filter.label}
          aria-label={`Filter by ${filter.label}`}
        >
          <FontAwesomeIcon icon={filter.icon} />
        </button>
      ))}
    </div>
  )
}

export default ReadingProgressFilters

