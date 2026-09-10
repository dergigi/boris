import { describe, it, expect, vi } from 'vitest'
import { extractArticle } from '../../lib/extractArticle'
import { isPublicAddress, validateArticleUrl, resolvePublicAddress } from '../../lib/fetchArticlePage'
import { lookup } from 'node:dns/promises'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
const prose = 'This is the actual article, with enough meaningful prose to distinguish it from navigation. It explains how readers can save articles and read them later, without distractions or advertising. '

describe('local article extraction', () => {
  it('extracts prose, metadata and absolute URLs while stripping executable content', () => {
    const result = extractArticle(`<html><head><title>A useful article</title><meta property="og:image" content="/cover.jpg"></head><body>
      <nav><a href="/login">Sign in</a></nav><article><h1>A useful article</h1>
      <p>${prose.repeat(5)}</p><p><a href="../next">Next article</a></p><img src="./photo.jpg" onerror="alert(1)">
      <script>throw new Error('must never run')</script><p onclick="alert(1)">${prose}</p></article></body></html>`, 'https://example.com/posts/story')
    expect(result.title).toBe('A useful article')
    expect(result.image).toBe('https://example.com/cover.jpg')
    expect(result.html).toContain(prose)
    expect(result.html).toContain('https://example.com/posts/photo.jpg')
    expect(result.html).toContain('https://example.com/next')
    expect(result.html).not.toMatch(/onerror|onclick|<script|Sign in/)
  })
  it('rejects empty and thin pages', () => {
    expect(() => extractArticle('<html><body>Sign in</body></html>', 'https://example.com')).toThrow('could not extract')
  })
})

describe('public source validation', () => {
  it.each(['http://127.0.0.1', 'http://[::1]', 'http://10.0.0.1', 'http://169.254.169.254'])('blocks literal private targets %s', async url => {
    await expect(resolvePublicAddress(validateArticleUrl(url))).rejects.toThrow('public web pages')
  })
  it.each(['127.0.0.1', '0.0.0.0', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1'])('rejects non-public IP %s', address => expect(isPublicAddress(address)).toBe(false))
  it.each(['8.8.8.8', '2606:4700:4700::1111'])('allows public IP %s', address => expect(isPublicAddress(address)).toBe(true))
  it.each(['file:///etc/passwd', 'ftp://example.com', 'https://user:pass@example.com', 'http://example.com:8080'])('rejects unsupported URL %s', url => expect(() => validateArticleUrl(url)).toThrow())
  it('rejects DNS answers containing any private address', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] as never)
    await expect(resolvePublicAddress(new URL('https://example.com'))).rejects.toThrow('public web pages')
  })
})
