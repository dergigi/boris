import React, { useEffect, useState } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faSpinner, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import { fetchBorisZappers, ZapSender } from '../services/zapReceiptService'
import { fetchProfiles } from '../services/profileService'
import { UserSettings } from '../services/settingsService'
import { Models } from 'applesauce-core'
import { useEventModel } from 'applesauce-react/hooks'

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
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-zinc-100">
          Support Boris
        </h1>
        <p className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto">
          Thank you to everyone who has supported Boris! Your zaps help keep this project alive.
        </p>
      </div>

      {supporters.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">
          <p>No supporters yet. Be the first to zap Boris!</p>
        </div>
      ) : (
        <>
          {/* Whales Section */}
          {supporters.filter(s => s.isWhale).length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl md:text-2xl font-semibold mb-6 text-center text-zinc-200">
                <FontAwesomeIcon icon={faBolt} className="text-yellow-400 mr-2" />
                Mega Supporters
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8">
                {supporters.filter(s => s.isWhale).map(supporter => (
                  <SupporterCard key={supporter.pubkey} supporter={supporter} isWhale={true} />
                ))}
              </div>
            </div>
          )}

          {/* Regular Supporters Section */}
          {supporters.filter(s => !s.isWhale).length > 0 && (
            <div>
              <h2 className="text-xl md:text-2xl font-semibold mb-6 text-center text-zinc-200">
                Supporters
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 md:gap-6">
                {supporters.filter(s => !s.isWhale).map(supporter => (
                  <SupporterCard key={supporter.pubkey} supporter={supporter} isWhale={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-12 md:mt-16 text-center">
        <p className="text-sm text-zinc-500">
          Total supporters: {supporters.length} • 
          Total zaps: {supporters.reduce((sum, s) => sum + s.zapCount, 0)}
        </p>
      </div>
    </div>
  )
}

interface SupporterCardProps {
  supporter: SupporterProfile
  isWhale: boolean
}

const SupporterCard: React.FC<SupporterCardProps> = ({ supporter, isWhale }) => {
  const profile = useEventModel(Models.ProfileModel, [supporter.pubkey])

  const picture = profile?.picture
  const name = profile?.name || profile?.display_name || `${supporter.pubkey.slice(0, 8)}...`

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Avatar */}
        <div
          className={`rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center
            ${isWhale ? 'w-24 h-24 md:w-28 md:h-28' : 'w-16 h-16 md:w-20 md:h-20'}
            ${isWhale ? 'ring-4 ring-yellow-400' : 'ring-2 ring-zinc-700'}
          `}
          title={`${name} • ${supporter.totalSats.toLocaleString()} sats`}
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
              className={`text-zinc-600 ${isWhale ? 'text-5xl' : 'text-3xl'}`}
            />
          )}
        </div>

        {/* Whale Badge */}
        {isWhale && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-zinc-900">
            <FontAwesomeIcon icon={faBolt} className="text-zinc-900 text-sm" />
          </div>
        )}
      </div>

      {/* Name and Total */}
      <div className="mt-2 text-center">
        <p className={`font-medium text-zinc-200 truncate max-w-full ${isWhale ? 'text-sm' : 'text-xs'}`}>
          {name}
        </p>
        <p className={`text-zinc-500 ${isWhale ? 'text-xs' : 'text-[10px]'}`}>
          {supporter.totalSats.toLocaleString()} sats
        </p>
      </div>
    </div>
  )
}

export default Support

