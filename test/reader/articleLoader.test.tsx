// @vitest-environment jsdom
import { renderHook, cleanup, act } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import type { RelayPool } from 'applesauce-relay'
import type { Highlight } from '../../src/types/highlights'
import { useArticleLoader } from '../../src/hooks/useArticleLoader'
import { getFromCache } from '../../src/services/articleService'
import { fetchHighlightsForArticle } from '../../src/services/highlightService'
vi.mock('react-router-dom', () => ({ useLocation: () => ({ state: null }) }))
vi.mock('../../src/services/articleService', () => ({ getFromCache: vi.fn(), saveToCache: vi.fn(), fetchArticleByNaddr: vi.fn() }))
vi.mock('../../src/services/highlightService', () => ({ fetchHighlightsForArticle: vi.fn() }))
vi.mock('../../src/hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('../../src/hooks/useImageCache', () => ({ preloadImage: vi.fn() }))
const callbacks = () => ({ setSelectedUrl: vi.fn(), setReaderContent: vi.fn(), setReaderLoading: vi.fn(), setIsCollapsed: vi.fn(), setHighlights: vi.fn(), setHighlightsLoading: vi.fn(), setCurrentArticleCoordinate: vi.fn(), setCurrentArticleEventId: vi.fn() })
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchHighlightsForArticle).mockResolvedValue([]) })
afterEach(cleanup)
it('does not clear another loader’s content when inactive or relays change', () => {
  const cb = callbacks()
  const hook = renderHook(({ pool }) => useArticleLoader({ ...cb, naddr: undefined, relayPool: pool }), { initialProps: { pool: null as RelayPool | null } })
  hook.rerender({ pool: {} as RelayPool })
  expect(cb.setReaderContent).not.toHaveBeenCalled()
})
it('ignores highlights from the previous cached article after switching', async () => {
  const cb = callbacks()
  const pending: Array<(highlight: Highlight) => void> = []
  vi.mocked(getFromCache).mockImplementation(naddr => ({ title: naddr, markdown: 'Article body', author: 'author', event: { id: naddr, kind: 30023, pubkey: 'author', tags: [['d', naddr]], created_at: 1, content: 'Article body', sig: '' } }))
  vi.mocked(fetchHighlightsForArticle).mockImplementation(async (_pool, _coord, _id, callback) => { pending.push(callback!); return [] })
  const pool = {} as RelayPool
  const hook = renderHook(({ naddr }) => useArticleLoader({ ...cb, naddr, relayPool: pool }), { initialProps: { naddr: 'old' } })
  hook.rerender({ naddr: 'new' })
  cb.setHighlights.mockClear()
  await act(async () => pending[0]({ id: 'old-highlight' } as Highlight))
  expect(cb.setHighlights).not.toHaveBeenCalled()
  await act(async () => pending[1]({ id: 'new-highlight' } as Highlight))
  expect(cb.setHighlights).toHaveBeenCalledTimes(1)
})
