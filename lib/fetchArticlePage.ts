import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import ipaddr from 'ipaddr.js'

export class ReaderError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function validateArticleUrl(input: string): URL {
  let url: URL
  try { url = new URL(input) } catch { throw new ReaderError(400, 'Enter a valid web URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) {
    throw new ReaderError(400, 'Only public HTTP and HTTPS pages are supported.')
  }
  url.hash = ''
  return url
}

export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === 'unicast' } catch { return false }
}

export async function resolvePublicAddress(url: URL) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new ReaderError(400, 'Only public web pages can be read.')
  }
  return addresses[0]
}

const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 12_000

async function fetchPage(url: URL, signal: AbortSignal) {
  // Resolve once, validate all answers, then pin the socket to the validated IP.
  // Redirects repeat this check; a second DNS lookup cannot rebind to a private IP.
  const address = await resolvePublicAddress(url)
  signal.throwIfAborted()
  return new Promise<{ html?: string; location?: string }>((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = request(url, {
      signal,
      headers: { Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'gzip, deflate, br', 'User-Agent': 'BorisReader/1.0' },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      family: address.family,
    }, async (res) => {
      try {
        const status = res.statusCode || 502
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume()
          if (!res.headers.location) throw new ReaderError(502, 'The page returned an invalid redirect.')
          resolve({ location: res.headers.location })
          return
        }
        if (status < 200 || status >= 300) throw new ReaderError(502, `The source website returned HTTP ${status}. Open the original page to continue.`)
        const type = res.headers['content-type'] || ''
        if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(type)) throw new ReaderError(415, 'This URL does not contain an HTML article.')
        const encoding = res.headers['content-encoding']
        const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null
        if (encoding && encoding !== 'identity' && !decoder) throw new ReaderError(415, 'Unsupported page encoding.')
        const stream = decoder ? res.pipe(decoder) : res
        if (decoder) res.on('error', err => decoder.destroy(err))
        const chunks: Buffer[] = []
        let bytes = 0
        for await (const chunk of stream) {
          bytes += chunk.length
          if (bytes > MAX_BYTES) throw new ReaderError(413, 'This page is too large to extract.')
          chunks.push(Buffer.from(chunk))
        }
        // JSDOM detects the declared charset and HTML meta charset from bytes.
        const { JSDOM } = await import('jsdom')
        const dom = new JSDOM(Buffer.concat(chunks), { url: url.href, contentType: type })
        try { resolve({ html: dom.serialize() }) } finally { dom.window.close() }
      } catch (error) {
        res.destroy()
        reject(error)
      }
    })
    req.on('error', reject)
    req.end()
  })
}

export async function fetchArticlePage(input: string) {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const work = async () => {
    let url = validateArticleUrl(input)
    for (let redirects = 0; redirects <= 5; redirects++) {
      const page = await fetchPage(url, signal)
      if (page.html !== undefined) return { html: page.html, url: url.href }
      url = validateArticleUrl(new URL(page.location!, url).href)
    }
    throw new ReaderError(502, 'The page redirected too many times.')
  }
  // DNS lookup also falls under the total deadline.
  let onAbort: () => void = () => {}
  try {
    return await Promise.race([work(), new Promise<never>((_, reject) => {
      onAbort = () => reject(new ReaderError(504, 'The source website took too long to respond. Please try again.'))
      signal.addEventListener('abort', onAbort, { once: true })
    })])
  } finally { signal.removeEventListener('abort', onAbort) }
}
