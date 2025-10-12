import React from 'react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, Helpers } from 'applesauce-core'
import { decode, npubEncode } from 'nostr-tools/nip19'
import { getProfileUrl } from '../config/nostrGateways'

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
  const display = profile?.name || profile?.display_name || profile?.nip05 || (pubkey ? `${pubkey.slice(0, 8)}...` : encoded)
  const npub = pubkey ? npubEncode(pubkey) : undefined

  if (npub) {
    return (
      <a
        href={getProfileUrl(npub)}
        className="nostr-mention"
        target="_blank"
        rel="noopener noreferrer"
      >
        @{display}
      </a>
    )
  }

  return <span className="nostr-mention">{encoded}</span>
}

export default ResolvedMention


