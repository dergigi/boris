// @vitest-environment jsdom
import { JSDOM } from 'jsdom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { fetchReadableContent, normalizeReaderUrl } from '../../src/services/readerService'
const url = 'https://example.com/article'
const content = { url, title: 'Article', html: '<p>Article text</p>' }
const respond = (body: unknown, status = 200, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } })
let storageDom: JSDOM
beforeEach(() => { storageDom = new JSDOM('', { url: 'https://boris.test' }); vi.stubGlobal('localStorage', storageDom.window.localStorage); localStorage.clear(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(content))) })
afterEach(() => { vi.unstubAllGlobals(); storageDom.window.close(); vi.useRealTimers() })
it('uses the first-party endpoint and reuses normalized cache keys', async () => {
  await fetchReadableContent('example.com/article#section')
  expect(fetch).toHaveBeenCalledWith('/api/reader?url=https%3A%2F%2Fexample.com%2Farticle', expect.anything())
  await fetchReadableContent(url)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('ignores legacy Jina caches and corrupt cache data', async () => {
  localStorage.setItem(`reader_cache_${url}`, JSON.stringify({ content: { ...content, title: 'Jina' }, timestamp: Date.now() }))
  localStorage.setItem(`reader_cache_v2_${url}`, '{broken')
  expect((await fetchReadableContent(url)).title).toBe('Article')
})
it('falls back to expired saved articles on network failure', async () => {
  localStorage.setItem(`reader_cache_v2_${url}`, JSON.stringify({ content, timestamp: Date.now() - 8 * 86400000 }))
  vi.mocked(fetch).mockRejectedValue(new Error('offline'))
  expect(await fetchReadableContent(url)).toEqual({ ...content, stale: true })
})
it.each([[{}, 200, 'application/json'], [{ error: 'Blocked' }, 502, 'application/json'], ['SPA shell', 200, 'text/html']])('rejects unusable responses and never caches them', async (body, status, type) => {
  vi.mocked(fetch).mockResolvedValue(respond(body, status as number, type as string))
  await expect(fetchReadableContent(url)).rejects.toThrow()
  expect(localStorage.length).toBe(0)
})
it('still returns content when storage is unavailable', async () => {
  vi.spyOn(Object.getPrototypeOf(localStorage), 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(await fetchReadableContent(url)).toEqual(content)
})
it('bypassCache refreshes a saved article', async () => {
  await fetchReadableContent(url)
  await fetchReadableContent(url, true)
  expect(fetch).toHaveBeenCalledTimes(2)
})
it('rejects non-web protocols', () => expect(() => normalizeReaderUrl('javascript:alert(1)')).toThrow())
it('bounds stalled requests', async () => {
  vi.useFakeTimers()
  vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))))
  const result = expect(fetchReadableContent(url)).rejects.toThrow('too long')
  await vi.advanceTimersByTimeAsync(20_000)
  await result
})
