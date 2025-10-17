import { Helpers } from 'applesauce-core'
import {
  ActiveAccount,
  IndividualBookmark
} from '../types/bookmarks'
import { BookmarkHiddenSymbol, hasNip04Decrypt, hasNip44Decrypt, processApplesauceBookmarks } from './bookmarkHelpers'
import type { NostrEvent } from './bookmarkHelpers'

type DecryptFn = (pubkey: string, content: string) => Promise<string>
type UnlockHiddenTagsFn = typeof Helpers.unlockHiddenTags
type HiddenContentSigner = Parameters<UnlockHiddenTagsFn>[1]
type UnlockMode = Parameters<UnlockHiddenTagsFn>[2]

/**
 * Wrap a decrypt promise with a timeout to prevent hanging (using 30s timeout for bunker)
 */
function withDecryptTimeout<T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Decrypt timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ])
}

export async function collectBookmarksFromEvents(
  bookmarkListEvents: NostrEvent[],
  activeAccount: ActiveAccount,
  signerCandidate?: unknown
): Promise<{
  publicItemsAll: IndividualBookmark[]
  privateItemsAll: IndividualBookmark[]
  newestCreatedAt: number
  latestContent: string
  allTags: string[][]
}> {
  const publicItemsAll: IndividualBookmark[] = []
  const privateItemsAll: IndividualBookmark[] = []
  let newestCreatedAt = 0
  let latestContent = ''
  let allTags: string[][] = []

  for (const evt of bookmarkListEvents) {
    newestCreatedAt = Math.max(newestCreatedAt, evt.created_at || 0)
    if (!latestContent && evt.content && !Helpers.hasHiddenContent(evt)) latestContent = evt.content
    if (Array.isArray(evt.tags)) allTags = allTags.concat(evt.tags)

    // Extract the 'd' tag and metadata for bookmark sets (kind 30003)
    const dTag = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] : undefined
    const setTitle = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'title')?.[1] : undefined
    const setDescription = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'description')?.[1] : undefined
    const setImage = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'image')?.[1] : undefined

    // Handle web bookmarks (kind:39701) as individual bookmarks
    if (evt.kind === 39701) {
      publicItemsAll.push({
        id: evt.id,
        content: evt.content || '',
        created_at: evt.created_at || Math.floor(Date.now() / 1000),
        pubkey: evt.pubkey,
        kind: evt.kind,
        tags: evt.tags || [],
        parsedContent: undefined,
        type: 'web' as const,
        isPrivate: false,
        added_at: evt.created_at || Math.floor(Date.now() / 1000),
        sourceKind: 39701,
        setName: dTag,
        setTitle,
        setDescription,
        setImage
      })
      continue
    }

    const pub = Helpers.getPublicBookmarks(evt)
    publicItemsAll.push(
      ...processApplesauceBookmarks(pub, activeAccount, false).map(i => ({
        ...i,
        sourceKind: evt.kind,
        setName: dTag,
        setTitle,
        setDescription,
        setImage
      }))
    )

    try {
      if (Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt) && signerCandidate) {
        try {
          await Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner)
        } catch {
          try {
            await Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner, 'nip44' as UnlockMode)
          } catch (err) {
          console.log("[bunker] ❌ nip44.decrypt failed:", err instanceof Error ? err.message : String(err))
            // ignore
          }
        }
      } else if (evt.content && evt.content.length > 0 && signerCandidate) {
        let decryptedContent: string | undefined
        try {
          if (hasNip44Decrypt(signerCandidate)) {
            decryptedContent = await withDecryptTimeout((signerCandidate as { nip44: { decrypt: DecryptFn } }).nip44.decrypt(
              evt.pubkey,
              evt.content
            ))
          }
        } catch (err) {
          console.log("[bunker] ❌ nip44.decrypt failed:", err instanceof Error ? err.message : String(err))
          // ignore
        }

        if (!decryptedContent) {
          try {
            if (hasNip04Decrypt(signerCandidate)) {
              decryptedContent = await withDecryptTimeout((signerCandidate as { nip04: { decrypt: DecryptFn } }).nip04.decrypt(
                evt.pubkey,
                evt.content
              ))
            }
          } catch (err) {
          console.log("[bunker] ❌ nip04.decrypt failed:", err instanceof Error ? err.message : String(err))
            // ignore
          }
        }

        if (decryptedContent) {
          try {
            const hiddenTags = JSON.parse(decryptedContent) as string[][]
            const manualPrivate = Helpers.parseBookmarkTags(hiddenTags)
            privateItemsAll.push(
              ...processApplesauceBookmarks(manualPrivate, activeAccount, true).map(i => ({
                ...i,
                sourceKind: evt.kind,
                setName: dTag,
                setTitle,
                setDescription,
                setImage
              }))
            )
            Reflect.set(evt, BookmarkHiddenSymbol, manualPrivate)
            Reflect.set(evt, 'EncryptedContentSymbol', decryptedContent)
            // Don't set latestContent to decrypted JSON - it's not user-facing content
          } catch (err) {
            // ignore
          }
        }
      }

      const priv = Helpers.getHiddenBookmarks(evt)
      if (priv) {
        privateItemsAll.push(
          ...processApplesauceBookmarks(priv, activeAccount, true).map(i => ({
            ...i,
            sourceKind: evt.kind,
            setName: dTag,
            setTitle,
            setDescription,
            setImage
          }))
        )
      }
    } catch {
      // ignore individual event failures
    }
  }

  return { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags }
}


