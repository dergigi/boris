import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faCheckCircle, faAsterisk } from '@fortawesome/free-solid-svg-icons'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBooks } from '../icons/customIcons'

export type ArchiveFilterType = 'all' | 'to-read' | 'reading' | 'completed' | 'marked'

interface ArchiveFiltersProps {
  selectedFilter: ArchiveFilterType
  onFilterChange: (filter: ArchiveFilterType) => void
}

const ArchiveFilters: React.FC<ArchiveFiltersProps> = ({ selectedFilter, onFilterChange }) => {
  const filters = [
    { type: 'all' as const, icon: faAsterisk, label: 'All' },
    { type: 'to-read' as const, icon: faBookmark, label: 'To Read' },
    { type: 'reading' as const, icon: faBookOpen, label: 'Reading' },
    { type: 'completed' as const, icon: faCheckCircle, label: 'Completed' },
    { type: 'marked' as const, icon: faBooks, label: 'Marked as Read' }
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

export default ArchiveFilters

