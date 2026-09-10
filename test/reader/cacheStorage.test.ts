// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { saveArticleCache } from '../../src/services/articleCacheStorage'
let dom: JSDOM
beforeEach(() => { dom = new JSDOM('', { url: 'https://boris.test' }); vi.stubGlobal('localStorage', dom.window.localStorage) })
afterEach(() => { vi.unstubAllGlobals(); dom.window.close() })
it('bounds relay article bursts without evicting a saved web read or user data', () => {
  localStorage.setItem('accounts', 'keep accounts')
  localStorage.setItem('settings', 'keep settings')
  saveArticleCache('reader_cache_v2_saved', JSON.stringify({ timestamp: 1, content: 'saved web article' }))
  for (let i = 0; i < 200; i++) saveArticleCache(`article_cache_${i}`, JSON.stringify({ timestamp: i, content: 'x'.repeat(20000) }))
  expect(localStorage.getItem('reader_cache_v2_saved')).toContain('saved web article')
  expect(localStorage.getItem('accounts')).toBe('keep accounts')
  expect(localStorage.getItem('settings')).toBe('keep settings')
  expect(localStorage.getItem('article_cache_0')).toBeNull()
  expect(localStorage.getItem('article_cache_199')).not.toBeNull()
  expect(localStorage.length).toBeLessThanOrEqual(102)
  expect(JSON.stringify(localStorage).length).toBeLessThan(1_510_000)
})
it('makes room for a web article when old background caches fill storage', () => {
  for (let i = 0; i < 100; i++) localStorage.setItem(`article_cache_${i}`, JSON.stringify({ timestamp: i, content: 'x'.repeat(45000) }))
  expect(saveArticleCache('reader_cache_v2_new', JSON.stringify({ timestamp: 101, content: 'new' }))).toBe(true)
  expect(localStorage.getItem('reader_cache_v2_new')).toContain('new')
  expect(localStorage.getItem('article_cache_0')).toBeNull()
})
it('does not delete anything for an oversized or invalid entry', () => {
  localStorage.setItem('accounts', 'preserve')
  expect(saveArticleCache('reader_cache_v2_huge', 'x'.repeat(1_500_001))).toBe(false)
  expect(saveArticleCache('accounts', 'replace')).toBe(false)
  expect(localStorage.getItem('accounts')).toBe('preserve')
})
