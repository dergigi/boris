import React from 'react'
import { Link } from 'react-router-dom'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, Helpers } from 'applesauce-core'
import { decode, npubEncode } from 'nostr-tools/nip19'
import { getNpubFallbackDisplay } from '../utils/nostrUriResolver'

const { getPubkeyFromDecodeResult } = Helpers

interface ResolvedMentionProps {
  encoded?: string
}

const ResolvedMention: React.FC<ResolvedMentionProps> = ({ encoded }) => {
  if (!encoded) return null
  let pubkey: string | undefined
  try {
    pubkey = getPubkeyFromDecodeResult(decode(encoded))
  } catch {
    // ignore; will fallback to showing the encoded value
  }

  const profile = pubkey ? useEventModel(Models.ProfileModel, [pubkey]) : undefined
  const display = profile?.name || profile?.display_name || profile?.nip05 || (pubkey ? getNpubFallbackDisplay(pubkey) : encoded)
  const npub = pubkey ? npubEncode(pubkey) : undefined

  if (npub) {
    return (
      <Link
        to={`/p/${npub}`}
        className="nostr-mention"
      >
        @{display}
      </Link>
    )
  }

  return <span className="nostr-mention">{encoded}</span>
}

export default ResolvedMention


