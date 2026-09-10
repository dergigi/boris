import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
import { ReaderError } from './fetchArticlePage.js'

// Keep extraction independent of transport so another local engine can replace it.
export function extractArticle(html: string, url: string) {
  const dom = new JSDOM(html, { url }) // Scripts and resource loading stay disabled.
  try {
    const doc = dom.window.document
    const imageValue = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]')?.getAttribute('content')
    let image: string | undefined
    try {
      const resolved = new URL(imageValue || '', url)
      if (imageValue && /^https?:$/.test(resolved.protocol)) image = resolved.href
    } catch { /* Optional metadata. */ }
    const article = new Readability(doc, { maxElemsToParse: 50_000 }).parse()
    if (!article?.content || (article.textContent?.trim().length || 0) < 140) {
      throw new ReaderError(422, 'Boris could not extract a readable article. Open the original page to continue.')
    }
    const htmlContent = createDOMPurify(dom.window).sanitize(article.content, {
      USE_PROFILES: { html: true }, FORBID_TAGS: ['form', 'input', 'button', 'style'], FORBID_ATTR: ['style'],
    })
    const published = article.publishedTime ? Date.parse(article.publishedTime) : NaN
    return { url, title: article.title || new URL(url).hostname, html: htmlContent,
      summary: article.excerpt || undefined, image,
      published: Number.isFinite(published) ? Math.floor(published / 1000) : undefined }
  } finally { dom.window.close() }
}
