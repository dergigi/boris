import { it, expect, vi, afterEach } from 'vitest'
import { Subject, of, throwError } from 'rxjs'
import type { RelayPool } from 'applesauce-relay'
import type { NostrEvent } from 'nostr-tools'
import { queryEvents } from '../../src/services/dataFetch'
const sampleEvent = { id: 'one', kind: 1, created_at: 1, content: 'hello', tags: [], pubkey: 'abc', sig: '' } as NostrEvent
const pool = (req: unknown) => ({ req, relays: new Map([['remote', { url: 'wss://relay.example' }]]) }) as RelayPool
afterEach(() => vi.useRealTimers())
it('completes on EOSE even when the subscription stays open', async () => {
  const source = new Subject()
  const result = queryEvents(pool(() => source), {})
  source.next(sampleEvent)
  source.next('EOSE')
  expect(await result).toEqual([sampleEvent])
  expect(source.observed).toBe(false)
})
it('times out stalled relays and preserves partial results', async () => {
  vi.useFakeTimers()
  const source = new Subject()
  const result = queryEvents(pool(() => source), {}, { timeoutMs: 100 })
  source.next(sampleEvent)
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toEqual([sampleEvent])
  expect(source.observed).toBe(false)
})
it('deduplicates events', async () => {
  expect(await queryEvents(pool(() => of(sampleEvent, sampleEvent, 'EOSE')), {})).toEqual([sampleEvent])
})
it('returns an empty result for no connected relays', async () => {
  expect(await queryEvents({ relays: new Map() } as RelayPool, {})).toEqual([])
})
it('keeps healthy relay results when the other group fails', async () => {
  const req = vi.fn((urls: string[]) => urls[0].includes('localhost') ? throwError(() => new Error('disconnected')) : of(sampleEvent, 'EOSE'))
  expect(await queryEvents(pool(req), {}, { relayUrls: ['ws://localhost:7777', 'wss://relay.example'] })).toEqual([sampleEvent])
})
