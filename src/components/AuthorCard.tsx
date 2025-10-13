import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserCircle } from '@fortawesome/free-solid-svg-icons'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { nip19 } from 'nostr-tools'

interface AuthorCardProps {
  authorPubkey: string
  clickable?: boolean
}

const AuthorCard: React.FC<AuthorCardProps> = ({ authorPubkey, clickable = true }) => {
  const navigate = useNavigate()
  const profile = useEventModel(Models.ProfileModel, [authorPubkey])
  
  const getAuthorName = () => {
    if (profile?.name) return profile.name
    if (profile?.display_name) return profile.display_name
    return `${authorPubkey.slice(0, 8)}...${authorPubkey.slice(-8)}`
  }
  
  const authorImage = profile?.picture || profile?.image
  const authorBio = profile?.about
  
  const handleClick = () => {
    if (clickable) {
      const npub = nip19.npubEncode(authorPubkey)
      navigate(`/p/${npub}`)
    }
  }
  
  return (
    <div 
      className={`author-card ${clickable ? 'author-card-clickable' : ''}`}
      onClick={handleClick}
      style={clickable ? { cursor: 'pointer' } : undefined}
    >
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

