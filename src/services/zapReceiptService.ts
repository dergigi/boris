import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { BORIS_PUBKEY } from './highlightCreationService'

export interface ZapSender {
  pubkey: string
  totalSats: number
  zapCount: number
  isWhale: boolean // >= 69420 sats
}

/**
 * Fetches zap receipts (kind:9735) for Boris and aggregates by sender
 * @param relayPool - The relay pool to query
 * @returns Array of senders who zapped >= 2100 sats, sorted by total desc
 */
export async function fetchBorisZappers(
  relayPool: RelayPool
): Promise<ZapSender[]> {
  try {
    console.log('⚡ Fetching zap receipts for Boris...')
    
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    // Fetch zap receipts with Boris as recipient
    const filter = {
      kinds: [9735],
      '#p': [BORIS_PUBKEY]
    }

    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, filter)
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, filter)
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const zapReceipts = await lastValueFrom(
      merge(local$, remote$).pipe(toArray())
    )

    console.log(`📊 Fetched ${zapReceipts.length} zap receipts`)

    // Dedupe by event ID
    const uniqueReceipts = new Map<string, NostrEvent>()
    zapReceipts.forEach(receipt => {
      if (!uniqueReceipts.has(receipt.id)) {
        uniqueReceipts.set(receipt.id, receipt)
      }
    })

    // Aggregate by sender
    const senderTotals = new Map<string, { totalSats: number; zapCount: number }>()

    for (const receipt of uniqueReceipts.values()) {
      const senderPubkey = extractSenderPubkey(receipt)
      const amountSats = extractAmountSats(receipt)

      if (!senderPubkey || amountSats === null) {
        continue
      }

      const existing = senderTotals.get(senderPubkey) || { totalSats: 0, zapCount: 0 }
      senderTotals.set(senderPubkey, {
        totalSats: existing.totalSats + amountSats,
        zapCount: existing.zapCount + 1
      })
    }

    // Filter >= 2100 sats, mark whales >= 69420 sats, sort by total desc
    const zappers: ZapSender[] = Array.from(senderTotals.entries())
      .filter(([_, data]) => data.totalSats >= 2100)
      .map(([pubkey, data]) => ({
        pubkey,
        totalSats: data.totalSats,
        zapCount: data.zapCount,
        isWhale: data.totalSats >= 69420
      }))
      .sort((a, b) => b.totalSats - a.totalSats)

    console.log(`✅ Found ${zappers.length} supporters (${zappers.filter(z => z.isWhale).length} whales)`)

    return zappers
  } catch (error) {
    console.error('Failed to fetch zap receipts:', error)
    return []
  }
}

/**
 * Extract sender pubkey from zap receipt
 * Try description.pubkey first, fallback to P tag
 */
function extractSenderPubkey(receipt: NostrEvent): string | null {
  // Try description tag (JSON-encoded zap request)
  const descTag = receipt.tags.find(t => t[0] === 'description')
  if (descTag && descTag[1]) {
    try {
      const zapRequest = JSON.parse(descTag[1])
      if (zapRequest.pubkey) {
        return zapRequest.pubkey
      }
    } catch {
      // Invalid JSON, continue
    }
  }

  // Fallback to P tag (sender from zap request)
  const pTag = receipt.tags.find(t => t[0] === 'P')
  if (pTag && pTag[1]) {
    return pTag[1]
  }

  return null
}

/**
 * Extract amount in sats from zap receipt
 * Use amount tag (millisats), skip if missing
 */
function extractAmountSats(receipt: NostrEvent): number | null {
  const amountTag = receipt.tags.find(t => t[0] === 'amount')
  if (!amountTag || !amountTag[1]) {
    return null
  }

  const millisats = parseInt(amountTag[1], 10)
  if (isNaN(millisats) || millisats <= 0) {
    return null
  }

  return Math.floor(millisats / 1000)
}

