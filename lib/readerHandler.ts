import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchArticlePage, ReaderError } from './fetchArticlePage.js'
import { extractArticle } from './extractArticle.js'

export async function readerHandler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      throw new ReaderError(405, 'Use GET to read an article.')
    }
    const urls = new URL(req.url || '/', 'http://boris.local').searchParams.getAll('url')
    if (urls.length !== 1 || !urls[0] || urls[0].length > 8192) throw new ReaderError(400, 'Provide one article URL.')
    const page = await fetchArticlePage(urls[0])
    const article = extractArticle(page.html, page.url)
    res.statusCode = 200
    res.end(JSON.stringify(article))
  } catch (error) {
    res.statusCode = error instanceof ReaderError ? error.status : 502
    res.end(JSON.stringify({ error: error instanceof ReaderError ? error.message : 'Unable to retrieve this page. Please try again or open the original.' }))
  }
}
