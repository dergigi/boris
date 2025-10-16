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

// Timeout helper to avoid hanging decrypt/unlock calls
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`[timeout] ${label} after ${ms}ms`)), ms)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer as NodeJS.Timeout)
  }
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
        console.log('[bunker] 🔓 Attempting to unlock hidden tags:', {
          eventId: evt.id?.slice(0, 8),
          kind: evt.kind,
          hasHiddenTags: true
        })
        try {
          await withTimeout(
            Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner),
            5000,
            'unlockHiddenTags(nip04)'
          )
          console.log('[bunker] ✅ Unlocked hidden tags with nip04')
        } catch (err) {
          console.log('[bunker] ⚠️  nip04 unlock failed (or timed out), trying nip44:', err)
          try {
            await withTimeout(
              Helpers.unlockHiddenTags(evt, signerCandidate as HiddenContentSigner, 'nip44' as UnlockMode),
              5000,
              'unlockHiddenTags(nip44)'
            )
            console.log('[bunker] ✅ Unlocked hidden tags with nip44')
          } catch (err2) {
            console.log('[bunker] ❌ nip44 unlock failed (or timed out):', err2)
          }
        }
      } else if (evt.content && evt.content.length > 0 && signerCandidate) {
        console.log('[bunker] 🔓 Attempting to decrypt content:', {
          eventId: evt.id?.slice(0, 8),
          kind: evt.kind,
          contentLength: evt.content.length,
          contentPreview: evt.content.slice(0, 20) + '...'
        })
        
        let decryptedContent: string | undefined
        try {
          if (hasNip44Decrypt(signerCandidate)) {
            console.log('[bunker] Trying nip44 decrypt...')
            decryptedContent = await withTimeout(
              (signerCandidate as { nip44: { decrypt: DecryptFn } }).nip44.decrypt(
                evt.pubkey,
                evt.content
              ),
              6000,
              'nip44.decrypt'
            )
            console.log('[bunker] ✅ nip44 decrypt succeeded')
          }
        } catch (err) {
          console.log('[bunker] ⚠️  nip44 decrypt failed (or timed out):', err)
        }

        if (!decryptedContent) {
          try {
            if (hasNip04Decrypt(signerCandidate)) {
              console.log('[bunker] Trying nip04 decrypt...')
              decryptedContent = await withTimeout(
                (signerCandidate as { nip04: { decrypt: DecryptFn } }).nip04.decrypt(
                  evt.pubkey,
                  evt.content
                ),
                6000,
                'nip04.decrypt'
              )
              console.log('[bunker] ✅ nip04 decrypt succeeded')
            }
          } catch (err) {
            console.log('[bunker] ❌ nip04 decrypt failed:', err)
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
          } catch {
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


