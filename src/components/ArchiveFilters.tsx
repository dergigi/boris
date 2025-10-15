import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faBookmark, faCheckCircle } from '@fortawesome/free-solid-svg-icons'
import { faBooks } from '../icons/customIcons'

export type ArchiveFilterType = 'all' | 'to-read' | 'reading' | 'completed' | 'marked'

interface ArchiveFiltersProps {
  selectedFilter: ArchiveFilterType
  onFilterChange: (filter: ArchiveFilterType) => void
}

const ArchiveFilters: React.FC<ArchiveFiltersProps> = ({ selectedFilter, onFilterChange }) => {
  const filters: { id: ArchiveFilterType; label: string; icon: typeof faBookOpen }[] = [
    { id: 'all', label: 'All', icon: faBooks },
    { id: 'to-read', label: 'To Read', icon: faBookmark },
    { id: 'reading', label: 'Reading', icon: faBookOpen },
    { id: 'completed', label: 'Completed', icon: faCheckCircle },
    { id: 'marked', label: 'Marked', icon: faCheckCircle }
  ]

  return (
    <div className="bookmark-filters">
      {filters.map((filter) => (
        <button
          key={filter.id}
          className={`bookmark-filter-btn ${selectedFilter === filter.id ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.id)}
        >
          <FontAwesomeIcon icon={filter.icon} />
          <span>{filter.label}</span>
        </button>
      ))}
    </div>
  )
}

export default ArchiveFilters

