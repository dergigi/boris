import { nip19 } from 'nostr-tools'
import { RelayPool } from 'applesauce-relay'
import { fetchArticleByNaddr } from '../services/articleService'
import { fetchReadableContent, ReadableContent } from '../services/readerService'

export interface BookmarkReference {
  id: string
  kind: number
  tags: string[][]
  pubkey: string
}

export async function loadContent(
  url: string,
  relayPool: RelayPool,
  bookmark?: BookmarkReference
): Promise<ReadableContent> {
  // Check if this is a kind:30023 article
  if (bookmark && bookmark.kind === 30023) {
    const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1] || ''
    
    if (dTag !== undefined && bookmark.pubkey) {
      const pointer = {
        identifier: dTag,
        kind: 30023,
        pubkey: bookmark.pubkey,
      }
      const naddr = nip19.naddrEncode(pointer)
      const article = await fetchArticleByNaddr(relayPool, naddr)
      
      return {
        title: article.title,
        markdown: article.markdown,
        image: article.image,
        summary: article.summary,
        url: `nostr:${naddr}`
      }
    } else {
      throw new Error('Invalid article reference - missing d tag or pubkey')
    }
  } else {
    // For regular URLs, fetch readable content
    return await fetchReadableContent(url)
  }
}
