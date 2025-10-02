import React from 'react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { decode } from 'nostr-tools/nip19'
import { getPubkeyFromDecodeResult } from 'applesauce-core/helpers'
import { extractNprofilePubkeys } from '../utils/helpers'

interface Props { content: string }

const ContentWithResolvedProfiles: React.FC<Props> = ({ content }) => {
  const matches = extractNprofilePubkeys(content)
  const decoded = matches
    .map((m) => {
      try { return decode(m) } catch { return undefined }
    })
    .filter(Boolean)

  const lookups = decoded.map((res) => getPubkeyFromDecodeResult(res as any)).filter(Boolean) as string[]

  const profiles = lookups.map((pubkey) => ({ pubkey, profile: useEventModel(Models.ProfileModel, [pubkey]) }))

  let rendered = content
  matches.forEach((m, i) => {
    const pk = getPubkeyFromDecodeResult(decoded[i] as any)
    const found = profiles.find((p) => p.pubkey === pk)
    const name = found?.profile?.name || found?.profile?.display_name || found?.profile?.nip05 || `${pk?.slice(0,8)}...`
    if (name) rendered = rendered.replace(m, `@${name}`)
  })

  return <div className="bookmark-content">{rendered}</div>
}

export default ContentWithResolvedProfiles


