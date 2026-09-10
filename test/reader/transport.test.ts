import { Buffer } from 'node:buffer'
import { beforeEach, it, expect, vi } from 'vitest'
import { PassThrough } from 'node:stream'
import { EventEmitter } from 'node:events'
import { gzipSync } from 'node:zlib'
import { lookup } from 'node:dns/promises'
import { fetchArticlePage } from '../../lib/fetchArticlePage'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('node:http', () => ({ request: mocks.request }))
vi.mock('node:https', () => ({ request: mocks.request }))
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
function response(status: number, body: string | Buffer, headers: Record<string, string> = { 'content-type': 'text/html' }) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void }
    req.end = () => {
      const stream = Object.assign(new PassThrough(), { statusCode: status, headers })
      callback(stream)
      stream.end(body)
    }
    return req
  })
}
beforeEach(() => {
  mocks.request.mockReset()
  vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never)
})
it('fetches HTML and pins the socket DNS result to the validated address', async () => {
  response(200, '<html><body>Hello</body></html>')
  const page = await fetchArticlePage('https://example.com/article')
  expect(page.html).toContain('Hello')
  const options = mocks.request.mock.calls[0][1]
  const callback = vi.fn()
  options.lookup('example.com', {}, callback)
  expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4)
  expect(options.family).toBe(4)
})
it('checks redirects before connecting to their destination', async () => {
  response(302, '', { location: 'http://127.0.0.1/private' })
  await expect(fetchArticlePage('https://example.com')).rejects.toThrow('public web pages')
  expect(mocks.request).toHaveBeenCalledTimes(1)
})
it('resolves relative redirects and retains the final page URL', async () => {
  response(302, '', { location: '/new' })
  response(200, '<p>New content</p>')
  expect((await fetchArticlePage('https://example.com/old')).url).toBe('https://example.com/new')
  expect(lookup).toHaveBeenCalledTimes(2)
})
it('limits redirect loops', async () => {
  for (let i = 0; i < 6; i++) response(302, '', { location: '/loop' })
  await expect(fetchArticlePage('https://example.com')).rejects.toThrow('too many times')
})
it('limits decompressed response size', async () => {
  response(200, gzipSync('x'.repeat(3 * 1024 * 1024 + 1)), { 'content-type': 'text/html', 'content-encoding': 'gzip' })
  await expect(fetchArticlePage('https://example.com')).rejects.toThrow('too large')
})
it('decodes compressed non-UTF8 HTML', async () => {
  response(200, gzipSync(Buffer.from('<html><body>caf\xe9</body></html>', 'latin1')), { 'content-type': 'text/html; charset=windows-1252', 'content-encoding': 'gzip' })
  expect((await fetchArticlePage('https://example.com')).html).toContain('café')
})
it('rejects upstream errors and non-HTML files', async () => {
  response(403, '<p>Access denied</p>')
  await expect(fetchArticlePage('https://example.com')).rejects.toThrow('HTTP 403')
  response(200, 'pdf', { 'content-type': 'application/pdf' })
  await expect(fetchArticlePage('https://example.com')).rejects.toThrow('HTML article')
})
