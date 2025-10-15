import React, { useEffect, useState } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faSpinner, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import { fetchBorisZappers, ZapSender } from '../services/zapReceiptService'
import { fetchProfiles } from '../services/profileService'
import { UserSettings } from '../services/settingsService'
import { Models } from 'applesauce-core'
import { useEventModel } from 'applesauce-react/hooks'
import { useNavigate } from 'react-router-dom'
import { nip19 } from 'nostr-tools'

interface SupportProps {
  relayPool: RelayPool
  eventStore: IEventStore
  settings: UserSettings
}

type SupporterProfile = ZapSender

const Support: React.FC<SupportProps> = ({ relayPool, eventStore, settings }) => {
  const [supporters, setSupporters] = useState<SupporterProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSupporters = async () => {
      setLoading(true)
      try {
        const zappers = await fetchBorisZappers(relayPool)
        
        if (zappers.length > 0) {
          const pubkeys = zappers.map(z => z.pubkey)
          await fetchProfiles(relayPool, eventStore, pubkeys, settings)
        }
        
        setSupporters(zappers)
      } catch (error) {
        console.error('Failed to load supporters:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSupporters()
  }, [relayPool, eventStore, settings])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-16 md:mb-20">
          <div className="flex justify-center mb-8">
            <img 
              src="/thank-you.svg" 
              alt="Thank you" 
              className="w-56 h-56 md:w-72 md:h-72 opacity-90"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            Thank You!
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Your{' '}
            <a 
              href="https://www.readwithboris.com/#pricing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:no-underline"
              style={{ color: 'var(--color-primary)' }}
            >
              zaps
            </a>
            {' '}help keep this project alive.
          </p>
        </div>

        {supporters.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <p>No supporters yet. Be the first to zap Boris!</p>
          </div>
        ) : (
          <>
            {/* Whales Section */}
            {supporters.filter(s => s.isWhale).length > 0 && (
              <div className="mb-16 md:mb-20">
                <h2 className="text-2xl md:text-3xl font-semibold mb-8 md:mb-10 text-center" style={{ color: 'var(--color-text)' }}>
                  Legends
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-10">
                  {supporters.filter(s => s.isWhale).map(supporter => (
                    <SupporterCard key={supporter.pubkey} supporter={supporter} isWhale={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Supporters Section */}
            {supporters.filter(s => !s.isWhale).length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl md:text-2xl font-semibold mb-8 text-center" style={{ color: 'var(--color-text)' }}>
                  Supporters
                </h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4 md:gap-5">
                  {supporters.filter(s => !s.isWhale).map(supporter => (
                    <SupporterCard key={supporter.pubkey} supporter={supporter} isWhale={false} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-16 md:mt-20 pt-8 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="text-center space-y-4">
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Zap{' '}
              <a 
                href="https://njump.me/npub19802see0gnk3vjlus0dnmfdagusqrtmsxpl5yfmkwn9uvnfnqylqduhr0x" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:no-underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Boris
              </a>
              {' '}a{' '}
              <a 
                href="https://www.readwithboris.com/#pricing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:no-underline"
                style={{ color: 'var(--color-primary)' }}
              >
              meaningful amount of sats
            </a>
            {' '}and your avatar will show above.
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Total supporters: {supporters.length} • 
              Total zaps: {supporters.reduce((sum, s) => sum + s.zapCount, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SupporterCardProps {
  supporter: SupporterProfile
  isWhale: boolean
}

const SupporterCard: React.FC<SupporterCardProps> = ({ supporter, isWhale }) => {
  const navigate = useNavigate()
  const profile = useEventModel(Models.ProfileModel, [supporter.pubkey])

  const picture = profile?.picture
  const name = profile?.name || profile?.display_name || `${supporter.pubkey.slice(0, 8)}...`

  const handleClick = () => {
    const npub = nip19.npubEncode(supporter.pubkey)
    navigate(`/p/${npub}`)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Avatar */}
        <div
          className={`rounded-full overflow-hidden flex items-center justify-center cursor-pointer transition-transform hover:scale-105
            ${isWhale ? 'w-24 h-24 md:w-28 md:h-28 ring-4 ring-yellow-400' : 'w-10 h-10 md:w-12 md:h-12'}
          `}
          style={{ 
            backgroundColor: 'var(--color-bg-elevated)'
          }}
          title={`${name} • ${supporter.totalSats.toLocaleString()} sats`}
          onClick={handleClick}
        >
          {picture ? (
            <img
              src={picture}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <FontAwesomeIcon
              icon={faUserCircle}
              className={isWhale ? 'text-5xl' : 'text-3xl'}
              style={{ color: 'var(--color-border)' }}
            />
          )}
        </div>

        {/* Whale Badge */}
        {isWhale && (
          <div 
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2"
            style={{ borderColor: 'var(--color-bg)' }}
          >
            <FontAwesomeIcon icon={faHeart} className="text-zinc-900 text-sm" />
          </div>
        )}
      </div>

      {/* Name and Total */}
      <div className="mt-2 text-center">
        <p 
          className={`font-medium truncate max-w-full ${isWhale ? 'text-sm' : 'text-xs'}`}
          style={{ color: 'var(--color-text)' }}
        >
          {name}
        </p>
        <p 
          className={isWhale ? 'text-xs' : 'text-[10px]'}
          style={{ color: 'var(--color-text-muted)' }}
        >
          {supporter.totalSats.toLocaleString()} sats
        </p>
      </div>
    </div>
  )
}

export default Support

