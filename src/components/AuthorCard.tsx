import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserCircle } from '@fortawesome/free-solid-svg-icons'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'

interface AuthorCardProps {
  authorPubkey: string
}

const AuthorCard: React.FC<AuthorCardProps> = ({ authorPubkey }) => {
  const profile = useEventModel(Models.ProfileModel, [authorPubkey])
  
  const getAuthorName = () => {
    if (profile?.name) return profile.name
    if (profile?.display_name) return profile.display_name
    return `${authorPubkey.slice(0, 8)}...${authorPubkey.slice(-8)}`
  }
  
  const authorImage = profile?.picture || profile?.image
  const authorBio = profile?.about
  
  return (
    <div className="author-card">
      <div className="author-card-avatar">
        {authorImage ? (
          <img src={authorImage} alt={getAuthorName()} />
        ) : (
          <FontAwesomeIcon icon={faUserCircle} />
        )}
      </div>
      <div className="author-card-content">
        <div className="author-card-name">{getAuthorName()}</div>
        {authorBio && (
          <p className="author-card-bio">{authorBio}</p>
        )}
      </div>
    </div>
  )
}

export default AuthorCard

