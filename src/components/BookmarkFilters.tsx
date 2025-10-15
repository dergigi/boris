import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faNewspaper, faStickyNote, faCirclePlay } from '@fortawesome/free-regular-svg-icons'
import { faGlobe, faAsterisk } from '@fortawesome/free-solid-svg-icons'

export type BookmarkFilterType = 'all' | 'article' | 'video' | 'note' | 'web'

interface BookmarkFiltersProps {
  selectedFilter: BookmarkFilterType
  onFilterChange: (filter: BookmarkFilterType) => void
}

const BookmarkFilters: React.FC<BookmarkFiltersProps> = ({
  selectedFilter,
  onFilterChange
}) => {
  const filters = [
    { type: 'all' as const, icon: faAsterisk, label: 'All' },
    { type: 'article' as const, icon: faNewspaper, label: 'Articles' },
    { type: 'video' as const, icon: faCirclePlay, label: 'Videos' },
    { type: 'note' as const, icon: faStickyNote, label: 'Notes' },
    { type: 'web' as const, icon: faGlobe, label: 'Web' }
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

export default BookmarkFilters

