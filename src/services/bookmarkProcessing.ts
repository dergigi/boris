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
 * Decrypt/unlock a single event and return private bookmarks
 */
async function decryptEvent(
  evt: NostrEvent,
  activeAccount: ActiveAccount,
  signerCandidate: unknown,
  metadata: { dTag?: string; setTitle?: string; setDescription?: string; setImage?: string }
): Promise<IndividualBookmark[]> {
  const { dTag, setTitle, setDescription, setImage } = metadata
  const privateItems: IndividualBookmark[] = []

  try {
    if (Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt)) {
      try {
        await Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner)
      } catch {
        try {
          await Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner, 'nip44' as UnlockMode)
        } catch (err) {
          console.log("[bunker] ❌ nip44.decrypt failed:", err instanceof Error ? err.message : String(err))
        }
      }
    } else if (evt.content && evt.content.length > 0) {
      let decryptedContent: string | undefined
      
      // Try to detect encryption method from content format
      // NIP-44 starts with version byte (currently 0x02), NIP-04 is base64
      const looksLikeNip44 = evt.content.length > 0 && !evt.content.includes('?iv=')
      
      // Try the likely method first (no timeout - let it fail naturally like debug page)
      if (looksLikeNip44 && hasNip44Decrypt(signerCandidate)) {
        try {
          decryptedContent = await (signerCandidate as { nip44: { decrypt: DecryptFn } }).nip44.decrypt(evt.pubkey, evt.content)
        } catch (err) {
          console.log("[bunker] ❌ nip44.decrypt failed:", err instanceof Error ? err.message : String(err))
        }
      }

      // Fallback to nip04 if nip44 failed or content looks like nip04
      if (!decryptedContent && hasNip04Decrypt(signerCandidate)) {
        try {
          decryptedContent = await (signerCandidate as { nip04: { decrypt: DecryptFn } }).nip04.decrypt(evt.pubkey, evt.content)
        } catch (err) {
          console.log("[bunker] ❌ nip04.decrypt failed:", err instanceof Error ? err.message : String(err))
        }
      }

      if (decryptedContent) {
        try {
          const hiddenTags = JSON.parse(decryptedContent) as string[][]
          const manualPrivate = Helpers.parseBookmarkTags(hiddenTags)
          privateItems.push(
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
        } catch (err) {
          // ignore parse errors
        }
      }
    }

    const priv = Helpers.getHiddenBookmarks(evt)
    if (priv) {
      privateItems.push(
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

  return privateItems
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
  let newestCreatedAt = 0
  let latestContent = ''
  let allTags: string[][] = []

  // Build list of events needing decrypt and collect public items immediately
  const decryptJobs: Array<{ evt: NostrEvent; metadata: { dTag?: string; setTitle?: string; setDescription?: string; setImage?: string } }> = []

  for (const evt of bookmarkListEvents) {
    newestCreatedAt = Math.max(newestCreatedAt, evt.created_at || 0)
    if (!latestContent && evt.content && !Helpers.hasHiddenContent(evt)) latestContent = evt.content
    if (Array.isArray(evt.tags)) allTags = allTags.concat(evt.tags)

    const dTag = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] : undefined
    const setTitle = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'title')?.[1] : undefined
    const setDescription = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'description')?.[1] : undefined
    const setImage = evt.kind === 30003 ? evt.tags?.find((t: string[]) => t[0] === 'image')?.[1] : undefined
    const metadata = { dTag, setTitle, setDescription, setImage }

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

    // Schedule decrypt if needed
    if (signerCandidate && ((Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt)) || Helpers.hasHiddenContent(evt))) {
      decryptJobs.push({ evt, metadata })
    } else {
      // Check for already-unlocked hidden bookmarks
      const priv = Helpers.getHiddenBookmarks(evt)
      if (priv) {
        publicItemsAll.push(
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
    }
  }

  // Decrypt events sequentially
  const privateItemsAll: IndividualBookmark[] = []
  if (decryptJobs.length > 0 && signerCandidate) {
    // Disable queueing for batch operations to avoid blocking on user interaction
    const accountWithQueue = activeAccount as { disableQueue?: boolean }
    const originalQueueState = accountWithQueue.disableQueue
    accountWithQueue.disableQueue = true

    try {
      for (const job of decryptJobs) {
        const privateItems = await decryptEvent(job.evt, activeAccount, signerCandidate, job.metadata)
        if (privateItems && privateItems.length > 0) {
          privateItemsAll.push(...privateItems)
        }
      }
    } finally {
      // Restore original queue state
      accountWithQueue.disableQueue = originalQueueState
    }
  }

  return { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags }
}


