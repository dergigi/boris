<!-- 658dc3b5-4b0b-4d30-8cfa-a9326f1d467e f1d78d5b-786d-4658-ae4b-56278aba318e -->
# Lazy Load Me Component Tabs

## Overview

Currently, the Me component loads all data for all tabs upfront, causing 30+ second load times even when viewing a single tab. This plan implements lazy loading where only the active tab's data is fetched on demand.

## Implementation Strategy

Based on user requirements:

- Load only the active tab's data (pure lazy loading)
- No background prefetching
- Show cached data immediately, refresh in background when revisiting tabs
- Works for both `/me` (own profile) and `/p/` (other profiles) using the same code

## Key Insight

The Me component already handles both own profile and other profiles via the `isOwnProfile` flag. The lazy loading will naturally work for both cases:

- Own profile (`/me`): Loads all tabs including private data (bookmarks, reads)
- Other profiles (`/p/npub...`): Only loads public tabs (highlights, writings)

## Changes Required

### 1. Update Me.tsx Loading Logic

**Current behavior**: Single `useEffect` loads all data (highlights, writings, bookmarks, reads) regardless of active tab.

**New behavior**:

- Create separate loading functions per tab
- Load only active tab's data on mount and tab switches
- Show cached data immediately if available
- Refresh cached data in background when tab is revisited

**Key changes**:

- Remove the monolithic `loadData()` function
- Add `loadedTabs` state to track which tabs have been fetched
- Create tab-specific loaders: `loadHighlights()`, `loadWritings()`, `loadBookmarks()`, `loadReads()`
- Add `useEffect` that watches `activeTab` and loads data for current tab only
- Check cache first, display cached data, then refresh in background

**Code location**: Lines 64-123 in `src/components/Me.tsx`

### 2. Per-Tab Loading State

Add tab-specific loading tracking:

```typescript
const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set())
```

This prevents unnecessary reloads and allows showing cached data instantly.

### 3. Tab-Specific Load Functions

Create individual functions:

- `loadHighlightsTab()` - fetch highlights
- `loadWritingsTab()` - fetch writings  
- `loadReadingListTab()` - fetch bookmarks
- `loadReadsTab()` - fetch bookmarks first, then reads

Each function:

1. Checks cache, displays if available
2. Sets loading state
3. Fetches fresh data
4. Updates state and cache
5. Marks tab as loaded

### 4. Tab Switch Effect

Replace the current useEffect with:

```typescript
useEffect(() => {
  if (!activeTab || !viewingPubkey) return
  
  // Check if we have cached data
  const cached = getCachedMeData(viewingPubkey)
  if (cached) {
    // Show cached data immediately
    setHighlights(cached.highlights)
    setBookmarks(cached.bookmarks)
    setReads(cached.reads)
    // Continue to refresh in background
  }
  
  // Load data for active tab
  switch (activeTab) {
    case 'highlights':
      loadHighlightsTab()
      break
    case 'writings':
      loadWritingsTab()
      break
    case 'reading-list':
      loadReadingListTab()
      break
    case 'reads':
      loadReadsTab()
      break
  }
}, [activeTab, viewingPubkey, refreshTrigger])
```

### 5. Handle Pull-to-Refresh

Update pull-to-refresh logic to only reload the active tab instead of all tabs.

## Benefits

- Initial load: ~2-5s instead of 30+ seconds (only loads one tab)
- Tab switching: Instant with cached data, refreshes in background
- Network efficiency: Only fetches what the user views
- Better UX: Users see content immediately from cache

## Testing Checklist

- Verify each tab loads independently
- Confirm cached data shows immediately on tab switch
- Ensure background refresh works without flickering
- Test pull-to-refresh only reloads active tab
- Verify loading states per tab work correctly

### To-dos

- [ ] Create src/services/readsService.ts with fetchAllReads function
- [ ] Update Me.tsx to use reads instead of archive
- [ ] Update routes from /me/archive to /me/reads
- [ ] Update meCache.ts to use reads field
- [ ] Update filter logic to handle actual reading progress
- [ ] Test all 5 filters and data sources work correctly