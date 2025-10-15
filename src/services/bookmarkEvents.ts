export interface NostrEvent {
  id: string
  kind: number
  created_at: number
  tags: string[][]
  content: string
  pubkey: string
  sig: string
}

export function dedupeNip51Events(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>()
  for (const e of events) {
    if (e?.id && !byId.has(e.id)) byId.set(e.id, e)
  }
  const unique = Array.from(byId.values())

  // Separate web bookmarks (kind:39701) from list-based bookmarks
  const webBookmarks = unique.filter(e => e.kind === 39701)

  const bookmarkLists = unique
    .filter(e => e.kind === 10003 || e.kind === 30003 || e.kind === 30001)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  const latestBookmarkList = bookmarkLists.find(list => !list.tags?.some((t: string[]) => t[0] === 'd'))

  const byD = new Map<string, NostrEvent>()
  for (const e of unique) {
    if (e.kind === 10003 || e.kind === 30003 || e.kind === 30001) {
      const d = (e.tags || []).find((t: string[]) => t[0] === 'd')?.[1] || ''
      const prev = byD.get(d)
      if (!prev || (e.created_at || 0) > (prev.created_at || 0)) byD.set(d, e)
    }
  }

  const setsAndNamedLists = Array.from(byD.values())
  const out: NostrEvent[] = []
  if (latestBookmarkList) out.push(latestBookmarkList)
  out.push(...setsAndNamedLists)
  // Add web bookmarks as individual events
  out.push(...webBookmarks)
  return out
}


