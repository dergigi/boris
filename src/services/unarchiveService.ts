import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { RELAYS } from '../config/relays'
import { ARCHIVE_EMOJI, deleteReaction } from './reactionService'

/**
 * Returns the user's archive reactions (kind:7) for a given event id.
 */
export async function findArchiveReactionsForEvent(
  eventId: string,
  userPubkey: string,
  relayPool: RelayPool
): Promise<NostrEvent[]> {
  try {
    const filter = {
      kinds: [7],
      authors: [userPubkey],
      '#e': [eventId]
    }

    const events$ = relayPool
      .req(RELAYS, filter)
      .pipe(
        onlyEvents(),
        completeOnEose(),
        takeUntil(timer(2000)),
        toArray()
      )

    const events: NostrEvent[] = await lastValueFrom(events$)
    return events.filter(evt => evt.content === ARCHIVE_EMOJI)
  } catch (error) {
    console.error('[unarchive] findArchiveReactionsForEvent error:', error)
    return []
  }
}

/**
 * Returns the user's archive reactions (kind:17) for a given website URL.
 */
export async function findArchiveReactionsForWebsite(
  url: string,
  userPubkey: string,
  relayPool: RelayPool
): Promise<NostrEvent[]> {
  try {
    // Normalize URL same as creation
    let normalizedUrl = url
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      normalizedUrl = parsed.toString()
      if (normalizedUrl.endsWith('/')) normalizedUrl = normalizedUrl.slice(0, -1)
    } catch (e) {
      console.warn('[unarchive] URL normalize failed:', e)
    }

    const filter = {
      kinds: [17],
      authors: [userPubkey],
      '#r': [normalizedUrl]
    }

    const events$ = relayPool
      .req(RELAYS, filter)
      .pipe(
        onlyEvents(),
        completeOnEose(),
        takeUntil(timer(2000)),
        toArray()
      )

    const events: NostrEvent[] = await lastValueFrom(events$)
    return events.filter(evt => evt.content === ARCHIVE_EMOJI)
  } catch (error) {
    console.error('[unarchive] findArchiveReactionsForWebsite error:', error)
    return []
  }
}

/**
 * Sends deletion requests for all of the user's archive reactions to an event.
 * Returns the number of deletion requests published.
 */
export async function unarchiveEvent(
  eventId: string,
  account: IAccount,
  relayPool: RelayPool
): Promise<number> {
  try {
    const reactions = await findArchiveReactionsForEvent(eventId, account.pubkey, relayPool)
    await Promise.all(reactions.map(r => deleteReaction(r.id, account, relayPool)))
    return reactions.length
  } catch (error) {
    console.error('[unarchive] unarchiveEvent error:', error)
    return 0
  }
}

/**
 * Sends deletion requests for all of the user's archive reactions to a website URL.
 * Returns the number of deletion requests published.
 */
export async function unarchiveWebsite(
  url: string,
  account: IAccount,
  relayPool: RelayPool
): Promise<number> {
  try {
    const reactions = await findArchiveReactionsForWebsite(url, account.pubkey, relayPool)
    await Promise.all(reactions.map(r => deleteReaction(r.id, account, relayPool)))
    return reactions.length
  } catch (error) {
    console.error('[unarchive] unarchiveWebsite error:', error)
    return 0
  }
}


