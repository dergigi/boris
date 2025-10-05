import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkNostrMentions } from 'applesauce-content/markdown'
import { 
  getArticleTitle, 
  getArticleImage, 
  getArticlePublished, 
  getArticleSummary 
} from 'applesauce-core/helpers'
import { npubEncode } from 'nostr-tools/nip19'
import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'

interface ArticleProps {
  relayPool: RelayPool
}

const Article: React.FC<ArticleProps> = ({ relayPool }) => {
  const { naddr } = useParams<{ naddr: string }>()
  const [article, setArticle] = useState<NostrEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!naddr) return

    const fetchArticle = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Decode the naddr
        const decoded = nip19.decode(naddr)
        
        if (decoded.type !== 'naddr') {
          throw new Error('Invalid naddr format')
        }

        const pointer = decoded.data as AddressPointer

        // Define relays to query
        const relays = pointer.relays && pointer.relays.length > 0 
          ? pointer.relays 
          : [
              'wss://relay.damus.io',
              'wss://nos.lol',
              'wss://relay.nostr.band',
              'wss://relay.primal.net'
            ]

        // Fetch the article event
        const filter = {
          kinds: [pointer.kind],
          authors: [pointer.pubkey],
          '#d': [pointer.identifier]
        }

        // Use applesauce relay pool pattern
        const events = await lastValueFrom(
          relayPool
            .req(relays, filter)
            .pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
        )

        if (events.length > 0) {
          // Sort by created_at and take the most recent
          events.sort((a, b) => b.created_at - a.created_at)
          setArticle(events[0])
        } else {
          setError('Article not found')
        }
      } catch (err) {
        console.error('Failed to fetch article:', err)
        setError(err instanceof Error ? err.message : 'Failed to load article')
      } finally {
        setLoading(false)
      }
    }

    fetchArticle()
  }, [naddr, relayPool])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading article...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl text-red-500">Error: {error}</div>
        <Link to="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl">Article not found</div>
        <Link to="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    )
  }

  const title = getArticleTitle(article)
  const image = getArticleImage(article)
  const published = getArticlePublished(article)
  const summary = getArticleSummary(article)

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="btn btn-ghost mb-6">
          ← Back to Home
        </Link>

        {image && (
          <div className="w-full mb-6 rounded-lg overflow-hidden">
            <img 
              src={image} 
              alt={title} 
              className="w-full h-auto max-h-[400px] object-cover" 
            />
          </div>
        )}

        <article>
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          
          <div className="text-sm opacity-70 mb-2">
            By {npubEncode(article.pubkey).slice(0, 12)}...
          </div>
          
          {published && (
            <div className="text-sm opacity-60 mb-6">
              Published: {new Date(published * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          )}

          {summary && (
            <div className="text-lg opacity-80 italic mb-8 border-l-4 border-primary pl-4">
              {summary}
            </div>
          )}

          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkNostrMentions]}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  )
}

export default Article
