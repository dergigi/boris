import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { isValidZap, getZapSender, getZapAmount } from 'applesauce-core/helpers'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { BORIS_PUBKEY } from './highlightCreationService'
import { RELAYS } from '../config/relays'

export interface ZapSender {
  pubkey: string
  totalSats: number
  zapCount: number
  isWhale: boolean // >= 21 sats (testing: normally 69420)
}

/**
 * Fetches zap receipts (kind:9735) for Boris and aggregates by sender
 * @param relayPool - The relay pool to query
 * @returns Array of senders who zapped >= 2 sats, sorted by total desc
 */
export async function fetchBorisZappers(
  relayPool: RelayPool
): Promise<ZapSender[]> {
  try {
    console.log('⚡ Fetching zap receipts for Boris...', BORIS_PUBKEY)
    
    // Use all configured relays plus specific zap-heavy relays
    const zapRelays = [
      ...RELAYS,
      'wss://nostr.mutinywallet.com', // Common zap relay
      'wss://relay.getalby.com/v1', // Alby zap relay
    ]
    const prioritized = prioritizeLocalRelays(zapRelays)
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

    console.log(`📊 Fetched ${zapReceipts.length} raw zap receipts`)

    // Dedupe by event ID and validate
    const uniqueReceipts = new Map<string, NostrEvent>()
    let invalidCount = 0
    
    zapReceipts.forEach(receipt => {
      if (!uniqueReceipts.has(receipt.id)) {
        if (isValidZap(receipt)) {
          uniqueReceipts.set(receipt.id, receipt)
        } else {
          invalidCount++
        }
      }
    })

    console.log(`✅ ${uniqueReceipts.size} valid zap receipts (${invalidCount} invalid)`)

    // Aggregate by sender using applesauce helpers
    const senderTotals = new Map<string, { totalSats: number; zapCount: number }>()

    for (const receipt of uniqueReceipts.values()) {
      const senderPubkey = getZapSender(receipt)
      const amountMsats = getZapAmount(receipt)

      if (!senderPubkey || !amountMsats || amountMsats === 0) {
        console.warn('Invalid zap receipt - missing sender or amount:', receipt.id)
        continue
      }

      const amountSats = Math.floor(amountMsats / 1000)

      const existing = senderTotals.get(senderPubkey) || { totalSats: 0, zapCount: 0 }
      senderTotals.set(senderPubkey, {
        totalSats: existing.totalSats + amountSats,
        zapCount: existing.zapCount + 1
      })
    }

    console.log(`👥 Found ${senderTotals.size} unique senders`)

    // Filter >= 2 sats, mark whales >= 21 sats, sort by total desc
    // TODO: Restore to >= 2100 sats and >= 69420 sats for production
    const zappers: ZapSender[] = Array.from(senderTotals.entries())
      .filter(([, data]) => data.totalSats >= 2)
      .map(([pubkey, data]) => ({
        pubkey,
        totalSats: data.totalSats,
        zapCount: data.zapCount,
        isWhale: data.totalSats >= 21
      }))
      .sort((a, b) => b.totalSats - a.totalSats)

    console.log(`✅ Found ${zappers.length} supporters (${zappers.filter(z => z.isWhale).length} whales)`)

    return zappers
  } catch (error) {
    console.error('Failed to fetch zap receipts:', error)
    return []
  }
}


