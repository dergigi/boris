// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import type { RelayPool } from 'applesauce-relay'
import type { Highlight } from '../../src/types/highlights'
import { useExternalUrlLoader } from '../../src/hooks/useExternalUrlLoader'
import { fetchReadableContent } from '../../src/services/readerService'
import { fetchHighlightsForUrl } from '../../src/services/highlightService'
const state = vi.hoisted(() => ({ cached: [] as Highlight[] }))
vi.mock('../../src/services/readerService', () => ({ fetchReadableContent: vi.fn() }))
vi.mock('../../src/services/highlightService', () => ({ fetchHighlightsForUrl: vi.fn().mockResolvedValue([]) }))
vi.mock('../../src/hooks/useStoreTimeline', () => ({ useStoreTimeline: () => state.cached }))
vi.mock('../../src/hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
const callbacks = () => ({ setSelectedUrl: vi.fn(), setReaderContent: vi.fn(), setReaderLoading: vi.fn(), setIsCollapsed: vi.fn(), setHighlights: vi.fn(), setHighlightsLoading: vi.fn(), setCurrentArticleCoordinate: vi.fn(), setCurrentArticleEventId: vi.fn() })
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchHighlightsForUrl).mockResolvedValue([]); state.cached = [] })
afterEach(cleanup)
it('loads a web article before a relay pool exists', async () => {
  const cb = callbacks()
  vi.mocked(fetchReadableContent).mockResolvedValue({ url: 'https://example.com', html: '<p>Hello</p>' })
  renderHook(() => useExternalUrlLoader({ ...cb, url: 'https://example.com', relayPool: null }))
  await waitFor(() => expect(cb.setReaderContent).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>Hello</p>' })))
})
it('does not reload the article when highlights or relays become available', async () => {
  const cb = callbacks()
  vi.mocked(fetchReadableContent).mockResolvedValue({ url: 'https://example.com', html: '<p>Hello</p>' })
  const hook = renderHook(({ relayPool }: { relayPool: RelayPool | null }) => useExternalUrlLoader({ ...cb, url: 'https://example.com', relayPool }), { initialProps: { relayPool: null as RelayPool | null } })
  await waitFor(() => expect(fetchReadableContent).toHaveBeenCalledTimes(1))
  state.cached = [{ id: 'h', urlReference: 'https://example.com' } as Highlight]
  hook.rerender({ relayPool: {} as RelayPool })
  expect(fetchReadableContent).toHaveBeenCalledTimes(1)
  expect(fetchHighlightsForUrl).toHaveBeenCalledTimes(1)
})
it('ignores a late response after switching articles and aborts the old fetch', async () => {
  const cb = callbacks()
  let resolveOld!: (value: { url: string; html: string }) => void
  vi.mocked(fetchReadableContent).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    .mockResolvedValueOnce({ url: 'https://example.com/new', html: '<p>New</p>' })
  const hook = renderHook(({ url }) => useExternalUrlLoader({ ...cb, url, relayPool: null }), { initialProps: { url: 'https://example.com/old' } })
  const signal = vi.mocked(fetchReadableContent).mock.calls[0][2]
  hook.rerender({ url: 'https://example.com/new' })
  await waitFor(() => expect(cb.setReaderContent).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>New</p>' })))
  await act(async () => resolveOld({ url: 'https://example.com/old', html: '<p>Old</p>' }))
  expect(signal?.aborted).toBe(true)
  expect(cb.setReaderContent).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>New</p>' }))
})
it('exposes errors as text and ends the loading state', async () => {
  const cb = callbacks()
  vi.mocked(fetchReadableContent).mockRejectedValue(new Error('<img onerror="bad()">'))
  renderHook(() => useExternalUrlLoader({ ...cb, url: 'https://example.com', relayPool: null }))
  await waitFor(() => expect(cb.setReaderLoading).toHaveBeenLastCalledWith(false))
  expect(cb.setReaderContent).toHaveBeenLastCalledWith(expect.objectContaining({ error: '<img onerror="bad()">' }))
})
