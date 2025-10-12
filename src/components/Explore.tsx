import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faNewspaper } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { fetchContacts } from '../services/contactService'
import { fetchBlogPostsFromAuthors, BlogPostPreview } from '../services/exploreService'
import BlogPostCard from './BlogPostCard'
import { getCachedPosts, upsertCachedPost, setCachedPosts } from '../services/exploreCache'

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
        // show spinner but keep existing posts
        setLoading(true)
        setError(null)

        // Seed from in-memory cache if available to avoid empty flash
        const cached = getCachedPosts(activeAccount.pubkey)
        if (cached && cached.length > 0 && blogPosts.length === 0) {
          setBlogPosts(cached)
        }

        // Fetch the user's contacts (friends)
        const contacts = await fetchContacts(
          relayPool,
          activeAccount.pubkey,
          (partial) => {
            // When local contacts are available, kick off early posts fetch
            if (partial.size > 0) {
              const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
              fetchBlogPostsFromAuthors(
                relayPool,
                Array.from(partial),
                relayUrls,
                (post) => {
                  // merge into UI and cache as we stream
                  setBlogPosts((prev) => {
                    const exists = prev.some(p => p.event.id === post.event.id)
                    if (exists) return prev
                    const next = [...prev, post]
                    return next.sort((a, b) => {
                      const timeA = a.published || a.event.created_at
                      const timeB = b.published || b.event.created_at
                      return timeB - timeA
                    })
                  })
                  setCachedPosts(activeAccount.pubkey, upsertCachedPost(activeAccount.pubkey, post))
                }
              ).then((all) => {
                // Ensure union of streamed + final is displayed
                setBlogPosts((prev) => {
                  const byId = new Map(prev.map(p => [p.event.id, p]))
                  for (const post of all) byId.set(post.event.id, post)
                  const merged = Array.from(byId.values()).sort((a, b) => {
                    const timeA = a.published || a.event.created_at
                    const timeB = b.published || b.event.created_at
                    return timeB - timeA
                  })
                  setCachedPosts(activeAccount.pubkey, merged)
                  return merged
                })
              })
            }
          }
        )
        
        if (contacts.size === 0) {
          setError('You are not following anyone yet. Follow some people to see their blog posts!')
          setLoading(false)
          return
        }

        // After full contacts, do a final pass for completeness
        const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
        const posts = await fetchBlogPostsFromAuthors(relayPool, Array.from(contacts), relayUrls)

        if (posts.length === 0) {
          setError('No blog posts found from your friends yet')
        }

        setBlogPosts((prev) => {
          const byId = new Map(prev.map(p => [p.event.id, p]))
          for (const post of posts) byId.set(post.event.id, post)
          const merged = Array.from(byId.values()).sort((a, b) => {
            const timeA = a.published || a.event.created_at
            const timeB = b.published || b.event.created_at
            return timeB - timeA
          })
          setCachedPosts(activeAccount.pubkey, merged)
          return merged
        })
      } catch (err) {
        console.error('Failed to load blog posts:', err)
        setError('Failed to load blog posts. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadBlogPosts()
  }, [relayPool, activeAccount, blogPosts.length])

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
          <FontAwesomeIcon icon={faNewspaper} />
          Explore
        </h1>
        <p className="explore-subtitle">
          Discover blog posts from your friends on Nostr
        </p>
      </div>
      {loading && (
        <div className="explore-loading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Refreshing posts…</span>
        </div>
      )}
      <div className="explore-grid">
        {blogPosts.map((post) => (
          <BlogPostCard
            key={`${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1]}`}
            post={post}
            href={getPostUrl(post)}
          />
        ))}
        {!loading && blogPosts.length === 0 && (
          <div className="explore-empty" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No blog posts found yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Explore

