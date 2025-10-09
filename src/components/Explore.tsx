import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faCompass } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { fetchContacts } from '../services/contactService'
import { fetchBlogPostsFromAuthors, BlogPostPreview } from '../services/exploreService'
import BlogPostCard from './BlogPostCard'

interface ExploreProps {
  relayPool: RelayPool
}

const Explore: React.FC<ExploreProps> = ({ relayPool }) => {
  const activeAccount = Hooks.useActiveAccount()
  const [blogPosts, setBlogPosts] = useState<BlogPostPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadBlogPosts = async () => {
      if (!activeAccount) {
        setError('Please log in to explore content from your friends')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch the user's contacts (friends)
        const contacts = await fetchContacts(relayPool, activeAccount.pubkey)
        
        if (contacts.size === 0) {
          setError('You are not following anyone yet. Follow some people to see their blog posts!')
          setLoading(false)
          return
        }

        // Get relay URLs from pool
        const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
        
        // Fetch blog posts from friends
        const posts = await fetchBlogPostsFromAuthors(
          relayPool,
          Array.from(contacts),
          relayUrls
        )

        if (posts.length === 0) {
          setError('No blog posts found from your friends yet')
        }

        setBlogPosts(posts)
      } catch (err) {
        console.error('Failed to load blog posts:', err)
        setError('Failed to load blog posts. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadBlogPosts()
  }, [relayPool, activeAccount])

  const getPostUrl = (post: BlogPostPreview) => {
    // Get the d-tag identifier
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
    
    // Create naddr
    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: post.author,
      identifier: dTag
    })
    
    return `/a/${naddr}`
  }

  if (loading) {
    return (
      <div className="explore-container">
        <div className="explore-loading">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          <p>Loading blog posts from your friends...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="explore-container">
        <div className="explore-error">
          <FontAwesomeIcon icon={faExclamationCircle} size="2x" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="explore-container">
      <div className="explore-header">
        <h1>
          <FontAwesomeIcon icon={faCompass} />
          Explore
        </h1>
        <p className="explore-subtitle">
          Discover blog posts from your friends on Nostr
        </p>
      </div>
      <div className="explore-grid">
        {blogPosts.map((post) => (
          <BlogPostCard
            key={`${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1]}`}
            post={post}
            href={getPostUrl(post)}
          />
        ))}
      </div>
    </div>
  )
}

export default Explore

