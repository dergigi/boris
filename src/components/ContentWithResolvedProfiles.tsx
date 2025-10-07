import React from 'react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, Helpers } from 'applesauce-core'
import { decode } from 'nostr-tools/nip19'
import { extractNprofilePubkeys } from '../utils/helpers'

const { getPubkeyFromDecodeResult } = Helpers

interface Props { content: string }

const ContentWithResolvedProfiles: React.FC<Props> = ({ content }) => {
  const matches = extractNprofilePubkeys(content)
  const decoded = matches
    .map((m) => {
      try { return decode(m) } catch { return undefined as undefined }
    })
    .filter((v): v is ReturnType<typeof decode> => Boolean(v))

  const lookups = decoded
    .map((res) => getPubkeyFromDecodeResult(res))
    .filter((v): v is string => typeof v === 'string')

  const profiles = lookups.map((pubkey) => ({ pubkey, profile: useEventModel(Models.ProfileModel, [pubkey]) }))

  let rendered = content
  matches.forEach((m, i) => {
    const pk = getPubkeyFromDecodeResult(decoded[i])
    const found = profiles.find((p) => p.pubkey === pk)
    const name = found?.profile?.name || found?.profile?.display_name || found?.profile?.nip05 || `${pk?.slice(0,8)}...`
    if (name) rendered = rendered.replace(m, `@${name}`)
  })

  return <div className="bookmark-content">{rendered}</div>
}

export default ContentWithResolvedProfiles


