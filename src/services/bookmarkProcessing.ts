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

    const pub = Helpers.getPublicBookmarks(evt)
    publicItemsAll.push(...processApplesauceBookmarks(pub, activeAccount, false))

    try {
      if (Helpers.hasHiddenTags(evt) && Helpers.isHiddenTagsLocked(evt) && signerCandidate) {
        try {
          await Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner)
        } catch {
          try {
            await Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner, 'nip44' as UnlockMode)
          } catch {
            // ignore
          }
        }
      } else if (evt.content && evt.content.length > 0 && signerCandidate) {
        let decryptedContent: string | undefined
        try {
          if (hasNip44Decrypt(signerCandidate)) {
            decryptedContent = await (signerCandidate as { nip44: { decrypt: DecryptFn } }).nip44.decrypt(
              evt.pubkey,
              evt.content
            )
          }
        } catch {
          // ignore
        }

        if (!decryptedContent) {
          try {
            if (hasNip04Decrypt(signerCandidate)) {
              decryptedContent = await (signerCandidate as { nip04: { decrypt: DecryptFn } }).nip04.decrypt(
                evt.pubkey,
                evt.content
              )
            }
          } catch {
            // ignore
          }
        }

        if (decryptedContent) {
          try {
            const hiddenTags = JSON.parse(decryptedContent) as string[][]
            const manualPrivate = Helpers.parseBookmarkTags(hiddenTags)
            privateItemsAll.push(...processApplesauceBookmarks(manualPrivate, activeAccount, true))
            Reflect.set(evt, BookmarkHiddenSymbol, manualPrivate)
            Reflect.set(evt, 'EncryptedContentSymbol', decryptedContent)
            if (!latestContent) {
              latestContent = decryptedContent
            }
          } catch {
            // ignore
          }
        }
      }

      const priv = Helpers.getHiddenBookmarks(evt)
      if (priv) {
        privateItemsAll.push(...processApplesauceBookmarks(priv, activeAccount, true))
      }
    } catch {
      // ignore individual event failures
    }
  }

  return { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags }
}


