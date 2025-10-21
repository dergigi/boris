import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { RelayPool } from 'applesauce-relay'
import { EventStore } from 'applesauce-core'
import { Hooks } from 'applesauce-react'
import { createEventLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import RichContent from './RichContent'
import './EventViewer.css'

interface EventViewerProps {
  relayPool: RelayPool
  eventStore: EventStore | null
}

export default function EventViewer({ relayPool, eventStore }: EventViewerProps) {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<NostrEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !relayPool || !eventStore) return

    setLoading(true)
    setError(null)

    // Try to get from event store first
    const cachedEvent = eventStore.getEvent(eventId)
    if (cachedEvent) {
      setEvent(cachedEvent)
      setLoading(false)
      return
    }

    // Otherwise fetch from relays
    const eventLoader = createEventLoader(relayPool, {
      eventStore,
      cacheRequest: true
    })

    const subscription = eventLoader({ id: eventId }).subscribe({
      next: (fetchedEvent) => {
        setEvent(fetchedEvent)
        setLoading(false)
      },
      error: (err) => {
        console.error('Error fetching event:', err)
        setError('Failed to load event')
        setLoading(false)
      },
      complete: () => {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [eventId, relayPool, eventStore])

  if (loading) {
    return (
      <div className="event-viewer">
        <div className="event-viewer-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <h1>Loading event...</h1>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="event-viewer">
        <div className="event-viewer-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <h1>{error || 'Event not found'}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="event-viewer">
      <div className="event-viewer-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h1>Note</h1>
      </div>
      
      <div className="event-viewer-content">
        <div className="event-meta">
          <small className="event-id">
            <code>{eventId?.slice(0, 16)}...</code>
          </small>
          <small className="event-time">
            {new Date(event.created_at * 1000).toLocaleString()}
          </small>
        </div>

        <div className="event-text">
          <RichContent content={event.content} />
        </div>
      </div>
    </div>
  )
}
